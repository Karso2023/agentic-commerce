import asyncio
import logging

from config import settings
from models.schemas import ShoppingSpec, Product
from models.enums import Category
from services.mock_data import get_mock_products
from services.serpapi_client import search_shopping

logger = logging.getLogger(__name__)


def _build_query(
    category: Category,
    requirements: list[str],
    size: str,
    scenario: str = "",
) -> str:
    """Build a search query from item spec and constraints. Size added only when the parsed spec has a concrete size (not N/A)."""
    category_name = category.value.replace("_", " ")
    req_str = " ".join(requirements) if requirements else ""
    scenario_word = (scenario.replace("_", " ").strip() if scenario else "").strip()
    parts = [req_str, scenario_word, category_name]
    if size and size.strip().upper() not in ("", "N/A"):
        parts.append(size.strip())
    return " ".join(p for p in parts if p).strip() or category_name


async def _discover_for_category(
    category: Category,
    requirements: list[str],
    constraints_size: str,
    budget_per_item: float,
    scenario: str = "",
) -> list[Product]:
    """Discover products for a single category from all sources."""
    products: list[Product] = []

    # Layer 1: SerpAPI (if not mock mode) - real data for any category
    if not settings.MOCK_MODE and settings.SERPAPI_KEY:
        query = _build_query(category, requirements, constraints_size, scenario)
        try:
            serp_products = await search_shopping(query, price_max=budget_per_item)
            products.extend(serp_products)
        except Exception as e:
            logger.error(f"SerpAPI error for {category.value}: {e}")

    # Mock data only when MOCK_MODE is on (off = real data only from SerpAPI)
    if settings.MOCK_MODE:
        from models.schemas import Constraints, Budget
        from datetime import date, timedelta

        mock_constraints = Constraints(
            budget=Budget(total=budget_per_item * 4),
            size=constraints_size,
            delivery_deadline=date.today() + timedelta(days=7),
        )
        mock_products = get_mock_products(category, mock_constraints)
        existing_names = {p.name.lower() for p in products}
        for mp in mock_products:
            if mp.name.lower() not in existing_names:
                products.append(mp)
                existing_names.add(mp.name.lower())

    return products


async def discover_products(spec: ShoppingSpec) -> dict[str, list[Product]]:
    """Discover products for all categories in the shopping spec.

    Uses async parallel requests for speed.
    """
    num_categories = len(spec.items_needed)
    budget_per_item = spec.constraints.budget.total / max(num_categories, 1)

    scenario = getattr(spec, "scenario", "") or ""

    # Run all category discoveries in parallel
    tasks = []
    categories = []
    for item in spec.items_needed:
        tasks.append(
            _discover_for_category(
                item.category,
                item.requirements,
                spec.constraints.size,
                budget_per_item,
                scenario,
            )
        )
        categories.append(item.category.value)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    products_by_category: dict[str, list[Product]] = {}
    for category_name, result in zip(categories, results):
        if isinstance(result, Exception):
            logger.error(f"Discovery error for {category_name}: {result}")
            products_by_category[category_name] = []
        else:
            products_by_category[category_name] = result

    return products_by_category
