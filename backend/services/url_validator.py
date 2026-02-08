"""
Validate product URLs so we only show links that still work and don't show
"Product no longer exists" (e.g. Amazon).

- On-serve validation: HTTP 2xx + fetch snippet + screenshot. Detect
  "no longer available" via text patterns and/or vision LLM (catches
  image-based error pages like Amazon's "sorry we couldn't find this page").
- Freshness: TTL cache per URL (valid 6h, invalid 1h).
- Semantic fallback: try rank #2, #3, … for first valid URL.
- Error-aware: per-domain backoff after failures.
"""

import re
import logging
import time
from urllib.parse import urlparse

from security import is_valid_product_url

logger = logging.getLogger(__name__)

# TTL: valid URLs cached 6h, invalid 1h (retry sooner for dead links)
TTL_VALID_SEC = 6 * 3600
TTL_INVALID_SEC = 1 * 3600
MAX_BODY_BYTES = 50_000
REQUEST_TIMEOUT = 8

# Patterns that indicate "product no longer available" / error page (case-insensitive)
UNAVAILABLE_PATTERNS = [
    r"product\s+no\s+longer\s+(exists|available|sold)",
    r"no\s+longer\s+(available|exists|sold|in\s+stock)",
    r"this\s+item\s+is\s+no\s+longer",
    r"discontinued",
    r"page\s+not\s+found",
    r"sorry[,.]?\s*we\s+(couldn't|could\s+not)\s+find",
    r"we\s+couldn't\s+find\s+that",
    r"item\s+not\s+found",
    r"product\s+not\s+found",
    r"no\s+longer\s+in\s+(our\s+)?(catalog|store)",
    r"has\s+been\s+removed",
    r"no\s+longer\s+carry",
    r"currently\s+unavailable",  # Amazon-style; often means gone
    r"out\s+of\s+stock",  # could be temporary; we still allow if other signals good
]
COMPILED_UNAVAILABLE = [re.compile(p, re.IGNORECASE | re.DOTALL) for p in UNAVAILABLE_PATTERNS]

# Weak product-page signals: if we see these, page might still be a product page
PRODUCT_SIGNALS = [
    r"add\s+to\s+(cart|bag)",
    r"buy\s+now",
    r"[\$£]\s*[\d,]+(?:\.\d{2})?",  # price
    r"price[:\s]",
]
COMPILED_PRODUCT = [re.compile(p, re.IGNORECASE) for p in PRODUCT_SIGNALS]

# In-memory cache: url -> (is_valid: bool, timestamp)
_url_cache: dict[str, tuple[bool, float]] = {}
# Per-domain failure count for backoff (optional)
_domain_errors: dict[str, float] = {}
DOMAIN_BACKOFF_SEC = 3600  # 1 hour backoff per domain after repeated failures


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc or ""
    except Exception:
        return ""


def _page_indicates_unavailable(text: str) -> bool:
    """True if page content suggests product no longer available / error page."""
    if not text or len(text) < 50:
        return False
    # Prefer stripping simple tags for pattern matching
    text_lower = re.sub(r"<[^>]+>", " ", text).replace("&nbsp;", " ").lower()
    for pat in COMPILED_UNAVAILABLE:
        if pat.search(text_lower):
            return True
    return False


def _page_has_product_signals(text: str) -> bool:
    """True if we see buy/price-like content (suggests live product page)."""
    if not text:
        return False
    text_lower = re.sub(r"<[^>]+>", " ", text).replace("&nbsp;", " ").lower()
    for pat in COMPILED_PRODUCT:
        if pat.search(text_lower):
            return True
    return False


def _fetch_page_snippet(url: str) -> str | None:
    """Fetch first MAX_BODY_BYTES of url. Returns None on error."""
    try:
        import requests
        resp = requests.get(
            url.strip(),
            headers={"User-Agent": "Mozilla/5.0 (compatible; AgenticCommerce/1.0)"},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
            stream=True,
        )
        if resp.status_code != 200:
            return None
        chunk = b""
        for b in resp.iter_content(chunk_size=8192):
            chunk += b
            if len(chunk) >= MAX_BODY_BYTES:
                break
        return chunk.decode("utf-8", errors="replace")
    except Exception as e:
        logger.warning("url_validator fetch %s: %s", url[:80], e)
        return None


def _llm_says_unavailable(snippet: str) -> bool | None:
    """Ask LLM if snippet indicates product no longer available. Returns True/False or None if skip."""
    from config import settings
    if not settings.OPENAI_API_KEY:
        return None
    text = re.sub(r"<[^>]+>", " ", snippet)[:3000].strip()
    if len(text) < 100:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=10,
            messages=[
                {
                    "role": "system",
                    "content": "You are a classifier. Answer only YES or NO.",
                },
                {
                    "role": "user",
                    "content": (
                        "Does this product page content indicate that the product is no longer available, "
                        "discontinued, or that the page is an error/not found page? Answer only YES or NO.\n\n"
                        f"Content:\n{text[:2500]}"
                    ),
                },
            ],
        )
        ans = (r.choices[0].message.content or "").strip().upper()
        return "YES" in ans
    except Exception as e:
        logger.warning("url_validator LLM check failed: %s", e)
        return None


def _screenshot_page(url: str) -> bytes | None:
    """Capture screenshot of page (above the fold). Returns PNG bytes or None."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.warning("playwright not installed; run: pip install playwright && playwright install chromium")
        return None
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page(
                    viewport={"width": 1280, "height": 800},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                )
                page.goto(url.strip(), wait_until="domcontentloaded", timeout=REQUEST_TIMEOUT * 1000)
                page.wait_for_timeout(1500)  # let images/error messages render
                png = page.screenshot(type="png", full_page=False)
                return png
            finally:
                browser.close()
    except Exception as e:
        logger.warning("url_validator screenshot %s: %s", url[:60], e)
        return None


def _vision_says_unavailable(image_png_bytes: bytes) -> bool | None:
    """Use vision model to detect if page screenshot shows 'product no longer available' or error. Returns True/False/None."""
    from config import settings
    if not settings.OPENAI_API_KEY:
        return None
    import base64
    b64 = base64.standard_b64encode(image_png_bytes).decode("ascii")
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        r = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=10,
            messages=[
                {
                    "role": "system",
                    "content": "You are a classifier. Look at the webpage screenshot. Answer only YES or NO.",
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Does this webpage show that the product is no longer available, or an error message "
                                "(e.g. 'Sorry, we couldn\'t find this page', 'Page Not Found', 'Product no longer available', "
                                "or similar text visible on the page)? Answer only YES or NO."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64}"},
                        },
                    ],
                },
            ],
        )
        ans = (r.choices[0].message.content or "").strip().upper()
        return "YES" in ans
    except Exception as e:
        logger.warning("url_validator vision check failed: %s", e)
        return None


def product_url_still_valid(url: str | None, use_llm_fallback: bool = True) -> bool:
    """
    True only if URL is valid, returns 2xx, and content does not indicate
    "product no longer available". Uses TTL cache and optional LLM.
    """
    if not is_valid_product_url(url):
        return False
    url = url.strip()
    now = time.time()
    if url in _url_cache:
        valid, ts = _url_cache[url]
        ttl = TTL_VALID_SEC if valid else TTL_INVALID_SEC
        if now - ts < ttl:
            return valid

    domain = _domain(url)
    if domain and _domain_errors.get(domain, 0.0) > now:
        return False  # back off this domain

    snippet = _fetch_page_snippet(url)
    if snippet is None:
        _url_cache[url] = (False, now)
        _domain_errors[domain] = now + DOMAIN_BACKOFF_SEC
        return False

    if _page_indicates_unavailable(snippet):
        _url_cache[url] = (False, now)
        return False

    # Vision check: catch image-based error pages (e.g. Amazon "sorry we couldn't find this page")
    from config import settings
    if settings.OPENAI_API_KEY:
        screenshot = _screenshot_page(url)
        if screenshot:
            vision_unavailable = _vision_says_unavailable(screenshot)
            if vision_unavailable is True:
                _url_cache[url] = (False, now)
                return False
            if vision_unavailable is False:
                _url_cache[url] = (True, now)
                return True
        # If screenshot failed, fall through to text/LLM

    # If we have strong product signals in text, treat as valid
    if _page_has_product_signals(snippet):
        _url_cache[url] = (True, now)
        return True

    if use_llm_fallback:
        llm_unavailable = _llm_says_unavailable(snippet)
        if llm_unavailable is True:
            _url_cache[url] = (False, now)
            return False
        if llm_unavailable is False:
            _url_cache[url] = (True, now)
            return True

    # No strong signal: treat as valid if we didn't hit unavailable patterns
    _url_cache[url] = (True, now)
    return True


def get_first_valid_compared_product(category_products: list, exclude_product_id: str):
    """
    Return the first ScoredProduct (other than exclude_product_id) whose
    product_url passes product_url_still_valid. Semantic fallback: try rank 2, 3, 4...
    """
    candidates = [
        sp for sp in category_products
        if getattr(sp, "product", None) and getattr(sp.product, "id", None) != exclude_product_id
    ]
    candidates.sort(key=lambda s: getattr(s, "rank", 99))

    for sp in candidates:
        product = getattr(sp, "product", None)
        if not product:
            continue
        url = getattr(product, "product_url", None)
        if not url:
            continue
        if product_url_still_valid(url):
            return sp
    return None
