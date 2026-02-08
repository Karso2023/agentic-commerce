import logging
from config import settings
from models.schemas import Product

logger = logging.getLogger(__name__)


async def search_shopping(
    query: str, price_max: float | None = None
) -> list[Product]:
    """Search Google Shopping via SerpAPI. Returns list of Products."""
    if not settings.SERPAPI_KEY:
        logger.info("No SERPAPI_KEY configured, skipping shopping search")
        return []

    try:
        from serpapi import GoogleSearch

        params = {
            "api_key": settings.SERPAPI_KEY,
            "engine": "google_shopping",
            "q": query,
            "gl": "us",
            "hl": "en",
        }
        if price_max:
            params["tbs"] = f"mr:1,price:1,ppr_max:{int(price_max)}"

        search = GoogleSearch(params)
        results = search.get_dict()
        shopping_results = results.get("shopping_results", [])

        products = []
        for i, item in enumerate(shopping_results[:10]):
            # SerpAPI returns "product_link" (Google Shopping page); "link" is used in some contexts for direct retailer URL
            product_url = item.get("link") or item.get("product_link")
            product = Product(
                id=f"serp-{item.get('product_id', f'unknown-{i}')}",
                name=item.get("title", "Unknown Product"),
                retailer=item.get("source", "Unknown"),
                price=item.get("extracted_price", 0.0),
                original_price=item.get("extracted_old_price"),
                rating=item.get("rating"),
                reviews_count=item.get("reviews"),
                delivery_text=item.get("delivery"),
                image_url=item.get("thumbnail"),
                product_url=product_url,
                brand=_extract_brand(item.get("title", "")),
            )
            # Parse delivery days from delivery text
            product.delivery_days = _parse_delivery_days(product.delivery_text)
            products.append(product)

        return products

    except Exception as e:
        logger.error(f"SerpAPI shopping search error: {e}")
        return []


async def get_product_detail(page_token: str) -> dict | None:
    """Fetch product details from Google Immersive Product API."""
    if not settings.SERPAPI_KEY:
        return None

    try:
        from serpapi import GoogleSearch

        params = {
            "api_key": settings.SERPAPI_KEY,
            "engine": "google_immersive_product",
            "page_token": page_token,
            "more_stores": "true",
        }

        search = GoogleSearch(params)
        results = search.get_dict()
        return results.get("product_results")

    except Exception as e:
        logger.error(f"SerpAPI immersive product error: {e}")
        return None


def _extract_brand(title: str) -> str | None:
    """Extract brand name from product title (first word or two)."""
    known_brands = [
        "Arc'teryx", "Patagonia", "The North Face", "Helly Hansen",
        "Columbia", "Burton", "Smith", "Oakley", "Giro", "Anon",
        "Black Diamond", "Hestra", "Dakine", "Smartwool", "Darn Tough",
        "Icebreaker", "Under Armour", "BUFF", "Outdoor Research",
    ]
    title_lower = title.lower()
    for brand in known_brands:
        if brand.lower() in title_lower:
            return brand
    return None


def _parse_delivery_days(delivery_text: str | None) -> int | None:
    """Parse estimated delivery days from delivery text."""
    if not delivery_text:
        return None

    text = delivery_text.lower()
    if "next-day" in text or "tomorrow" in text or "1-day" in text:
        return 1
    if "2-day" in text or "2 day" in text:
        return 2
    if "3-day" in text or "3 day" in text:
        return 3

    import re

    day_match = re.search(r"(\d+)\s*(?:business\s+)?days?", text)
    if day_match:
        return int(day_match.group(1))

    # Try to parse day-of-week references
    weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    from datetime import date, timedelta

    today = date.today()
    for i, day in enumerate(weekdays):
        if day in text:
            target_weekday = i
            days_ahead = (target_weekday - today.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7
            return days_ahead

    return None
