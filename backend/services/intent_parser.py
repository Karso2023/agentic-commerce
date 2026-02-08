import json
import logging
import re
from datetime import date, timedelta

from config import settings
from models.schemas import ShoppingSpec, ClarifyingQuestion
from security import sanitize_input, validate_json_response, build_hardened_system_prompt, wrap_user_input

logger = logging.getLogger(__name__)

INTENT_SYSTEM_PROMPT = build_hardened_system_prompt("""You are a general shopping assistant. Parse the user's message into a structured JSON shopping specification for ANY kind of products (skiing, electronics, running gear, office setup, clothing, etc.).

Output this exact JSON schema:
{
  "scenario": "<short scenario label, e.g. skiing_outfit, gaming_setup, running_gear, office_desk, casual_wear>",
  "items_needed": [
    {
      "category": "<one of: jacket, pants, base_layer_top, base_layer_bottom, gloves, goggles, helmet, socks, neck_gaiter, headset, monitor, keyboard, laptop, gpu, running_shoes, sneakers, t_shirt, hoodie, bag, watch, desk_chair, webcam, phone, tablet, speakers>",
      "priority": "must_have" | "nice_to_have",
      "requirements": ["relevant descriptors for the product", ...]
    }
  ],
  "constraints": {
    "budget": { "total": <number>, "currency": "USD" },
    "size": "XS" | "S" | "M" | "L" | "XL" | "XXL" | "N/A",
    "delivery_deadline": "YYYY-MM-DD",
    "style_preferences": [],
    "brand_preferences": [],
    "color_preferences": []
  }
}

If the user's message is about shopping but is missing critical info (budget or other key details when relevant), respond with ONLY a JSON object:
{"question": "<your clarifying question>", "is_clarification": true}

Ask ONE focused clarifying question. Don't ask multiple questions at once.

Map what the user wants to the categories above. Use the category list exactly as given (snake_case). If the user asks for something that does not fit the list, use the closest match or a short snake_case product type (e.g. gpu for graphics cards).

Budget: "total" must be the amount the user wants to spend (their budget), in USD. Use the number that appears with budget-related words (e.g. "budget 1000", "1000 quid", "under 500", "within 800"). Do NOT use product model numbers as budget (e.g. 5090 in "RTX 5090" is not a budget; if they say "budget within 1000 quid" the budget is 1000). Convert quid/pounds to USD if you use approximate conversion, or use the number as-is and set currency.

Size: Decide from the user's request whether the products use clothing/shoe sizing. Set "size" to "N/A" when the items in this request do not use S/M/L-type sizing (e.g. electronics, furniture, most gadgets). Set a concrete size (XS/S/M/L/XL/XXL) only when the user gave a size or when the products are typically wearables that come in sizes. Do not default to "M" when the products do not use apparel sizing.

Delivery deadline: You will be given today's date in the user message. If the user says something relative (e.g. "within 5 days", "by next week"), compute delivery_deadline as YYYY-MM-DD from that today's date. Always use the provided today's date, never use a date from the past or from your training.

RESPOND WITH ONLY VALID JSON. No markdown, no code blocks, no extra text.""")


async def parse_intent(message: str) -> ShoppingSpec | ClarifyingQuestion:
    """Parse a user message into a ShoppingSpec or ask a clarifying question.

    Uses OpenAI API when available, falls back to a mock spec otherwise.
    """
    sanitized = sanitize_input(message)

    if settings.MOCK_MODE or not settings.OPENAI_API_KEY:
        return _mock_parse(sanitized)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        today_str = date.today().isoformat()
        user_content = (
            f"Today's date is {today_str}. Use this date when computing any relative delivery deadlines (e.g. 'within 5 days' -> {today_str} + 5 days).\n\n"
            + wrap_user_input(sanitized)
        )
        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            messages=[
                {"role": "system", "content": INTENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )

        response_text = response.choices[0].message.content.strip()

        # Try to parse as JSON
        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            if "```" in response_text:
                json_str = response_text.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
                data = json.loads(json_str.strip())
            else:
                raise

        # Determine if it's a clarification or a spec
        if "is_clarification" in data or "question" in data:
            return validate_json_response(data, ClarifyingQuestion)
        else:
            spec = validate_json_response(data, ShoppingSpec)
            # Ensure delivery_deadline is never in the past (LLM may return old dates)
            if getattr(spec, "constraints", None) and getattr(spec.constraints, "delivery_deadline", None):
                try:
                    dd = spec.constraints.delivery_deadline
                    deadline_date = dd if isinstance(dd, date) else date.fromisoformat(str(dd).split("T")[0])
                    if deadline_date < date.today():
                        spec.constraints.delivery_deadline = date.today() + timedelta(days=5)
                except (ValueError, TypeError):
                    pass
            return spec

    except Exception as e:
        logger.error(f"OpenAI API error in parse_intent: {e}")
        return _mock_parse(sanitized)


def _extract_budget(message: str, msg_lower: str) -> float:
    """Extract budget from message; prefer numbers near budget/quid/dollar/under/within. Never use product model numbers (e.g. 5090)."""
    # Budget-related patterns (order matters: most specific first)
    patterns = [
        r"budget\s*(?:within|under|of|is)?\s*[£$]?\s*(\d+(?:\.\d+)?)",
        r"(\d+(?:\.\d+)?)\s*quid",
        r"(\d+(?:\.\d+)?)\s*(?:pound|pounds)\b",
        r"(?:under|within|max|up to)\s*[£$]?\s*(\d+(?:\.\d+)?)",
        r"(?:less than|below)\s*[£$]?\s*(\d+(?:\.\d+)?)",
        r"£\s*(\d+(?:\.\d+)?)",
        r"\$\s*(\d+(?:\.\d+)?)",
        r"(\d+(?:\.\d+)?)\s*dollars?\b",
    ]
    for pat in patterns:
        m = re.search(pat, msg_lower, re.IGNORECASE)
        if m:
            return float(m.group(1))

    # Fallback: any number, but exclude likely product model numbers (e.g. RTX 5090, 4080)
    all_numbers = re.findall(r"\b(\d+)\b", message)
    if not all_numbers:
        return 400.0
    # In GPU context, ignore 4-digit numbers that look like model numbers (4080, 4090, 5090)
    if any(x in msg_lower for x in ["rtx", "gpu", "graphics"]):
        for n in all_numbers:
            v = int(n)
            if v < 100 or (v < 10000 and v not in (4080, 4090, 5090, 5080, 4070)):
                return float(v)
        # If all are model-like (e.g. 5090), return 400 default
        return 400.0
    return float(all_numbers[0])


def _parse_size_from_message(msg_lower: str, message: str, has_size: bool) -> str:
    """Return concrete size only when user explicitly mentioned size; otherwise N/A (no hardcoded default)."""
    if not has_size:
        return "N/A"
    if "medium" in msg_lower or re.search(r"\bsize\s*m\b", message, re.IGNORECASE):
        return "M"
    if "large" in msg_lower and "extra" not in msg_lower:
        return "L"
    if "small" in msg_lower or re.search(r"\bsize\s*s\b", message, re.IGNORECASE):
        return "S"
    if "extra large" in msg_lower or "x-large" in msg_lower or re.search(r"\bxl\b", message, re.IGNORECASE):
        return "XL"
    if re.search(r"\bxxl\b", message, re.IGNORECASE):
        return "XXL"
    if re.search(r"\bxs\b", message, re.IGNORECASE):
        return "XS"
    return "N/A"


def _mock_parse(message: str) -> ShoppingSpec | ClarifyingQuestion:
    """Fallback mock parsing when OpenAI API is unavailable. Supports generic shopping (skiing, gaming, running, etc.)."""
    from datetime import date, timedelta

    from models.enums import Category

    msg_lower = message.lower()

    # Check for missing critical info
    has_budget = any(
        w in msg_lower for w in ["$", "budget", "spend", "dollar", "usd", "400", "500", "300", "200", "100"]
    )
    has_size = any(
        w in msg_lower
        for w in ["small", "medium", "large", "xl", "xxl", "size m", "size l", "size s"]
    )

    if not has_budget:
        return ClarifyingQuestion(
            question="What's your total budget? For example: '$400' or 'budget $300'"
        )

    budget = _extract_budget(message, msg_lower)

    deadline = date.today() + timedelta(days=5)
    days_match = re.search(r"(\d+)\s*days?", msg_lower)
    if days_match:
        deadline = date.today() + timedelta(days=int(days_match.group(1)))
    elif "week" in msg_lower and ("within" in msg_lower or "in a week" in msg_lower or "deliver within" in msg_lower):
        deadline = date.today() + timedelta(days=7)

    # Infer scenario and items from keywords (generic shopping)
    if any(w in msg_lower for w in ["rtx", "gpu", "graphics card", "5090", "4080", "4090"]):
        scenario = "gaming_setup"
        items = [{"category": "gpu", "priority": "must_have", "requirements": []}]
        size = "N/A"  # electronics
    elif any(w in msg_lower for w in ["gaming", "headset", "keyboard", "monitor", "desk", "laptop", "pc"]):
        scenario = "gaming_setup"
        items = [
            {"category": "headset", "priority": "must_have", "requirements": ["gaming"]},
            {"category": "keyboard", "priority": "must_have", "requirements": []},
            {"category": "monitor", "priority": "nice_to_have", "requirements": []},
        ]
        size = "N/A"  # electronics / non-apparel
    elif any(w in msg_lower for w in ["running", "jogging", "shoes"]):
        scenario = "running_gear"
        items = [
            {"category": "running_shoes", "priority": "must_have", "requirements": []},
            {"category": "t_shirt", "priority": "nice_to_have", "requirements": ["moisture-wicking"]},
        ]
        size = _parse_size_from_message(msg_lower, message, has_size)
    elif any(w in msg_lower for w in ["office", "chair", "webcam"]):
        scenario = "office_desk"
        items = [
            {"category": "desk_chair", "priority": "must_have", "requirements": []},
            {"category": "monitor", "priority": "nice_to_have", "requirements": []},
            {"category": "webcam", "priority": "nice_to_have", "requirements": []},
        ]
        size = "N/A"
    else:
        # Default: skiing outfit (or generic outdoor)
        scenario = "skiing_outfit"
        items = [
            {"category": "jacket", "priority": "must_have", "requirements": ["waterproof", "warm"]},
            {"category": "pants", "priority": "must_have", "requirements": ["waterproof"]},
            {"category": "gloves", "priority": "must_have", "requirements": ["warm"]},
            {"category": "goggles", "priority": "must_have", "requirements": []},
        ]
        size = _parse_size_from_message(msg_lower, message, has_size)

    return ShoppingSpec(
        scenario=scenario,
        items_needed=[{"category": c["category"], "priority": c["priority"], "requirements": c["requirements"]} for c in items],
        constraints={
            "budget": {"total": budget, "currency": "USD"},
            "size": size,
            "delivery_deadline": deadline.isoformat(),
            "style_preferences": [],
            "brand_preferences": [],
            "color_preferences": [],
        },
    )
