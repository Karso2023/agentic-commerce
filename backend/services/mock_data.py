import json
from pathlib import Path

from models.enums import Category
from models.schemas import Product, Constraints

_DATA_PATH = Path(__file__).parent.parent / "data" / "mock_retailers.json"

_mock_db: dict[str, list[dict]] = {}


def _load_mock_data() -> dict[str, list[dict]]:
    global _mock_db
    if not _mock_db:
        with open(_DATA_PATH, "r") as f:
            _mock_db = json.load(f)
    return _mock_db


def get_mock_products(
    category: Category, constraints: Constraints | None = None
) -> list[Product]:
    """Get mock products for a category, optionally filtered by constraints."""
    data = _load_mock_data()
    raw_products = data.get(category.value, [])

    products = []
    for item in raw_products:
        product = Product(**item)

        if constraints:
            # Filter by size only when size applies (apparel); skip for N/A
            if constraints.size and constraints.size.upper() != "N/A":
                if (
                    product.sizes
                    and constraints.size not in product.sizes
                    and "One Size" not in product.sizes
                ):
                    continue

        products.append(product)

    return products


def get_all_mock_products(
    constraints: Constraints | None = None,
) -> dict[str, list[Product]]:
    """Get mock products for all categories."""
    result = {}
    for category in Category:
        products = get_mock_products(category, constraints)
        if products:
            result[category.value] = products
    return result
