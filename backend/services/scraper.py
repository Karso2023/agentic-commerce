import json
import logging

import requests
from bs4 import BeautifulSoup

from models.schemas import Product

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def extract_schema_product(url: str) -> dict | None:
    """Extract product data from Schema.org JSON-LD on a product page."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string)
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if item.get("@type") == "Product":
                        offers = item.get("offers") or {}
                        if isinstance(offers, list):
                            offers = offers[0] if offers else {}
                        agg = item.get("aggregateRating") or {}
                        brand = item.get("brand")
                        if isinstance(brand, dict):
                            brand = brand.get("name")
                        image = item.get("image")
                        if isinstance(image, list):
                            image = image[0] if image else None
                        price = offers.get("price") if isinstance(offers, dict) else None
                        if price is not None and not isinstance(price, (int, float)):
                            try:
                                price = float(price)
                            except (TypeError, ValueError):
                                price = None
                        return {
                            "name": item.get("name"),
                            "price": price,
                            "currency": offers.get("priceCurrency") if isinstance(offers, dict) else None,
                            "availability": offers.get("availability") if isinstance(offers, dict) else None,
                            "rating": agg.get("ratingValue") if isinstance(agg, dict) else None,
                            "review_count": agg.get("reviewCount") if isinstance(agg, dict) else None,
                            "brand": brand,
                            "description": item.get("description"),
                            "image": image,
                        }
            except json.JSONDecodeError:
                continue

    except Exception as e:
        logger.error(f"Schema.org scraping error for {url}: {e}")

    return None


def enrich_product(product: Product, url: str) -> Product:
    """Enrich a product with scraped Schema.org data."""
    schema_data = extract_schema_product(url)
    if not schema_data:
        return product

    if not product.description and schema_data.get("description"):
        product.description = schema_data["description"]
    if not product.brand and schema_data.get("brand"):
        product.brand = schema_data["brand"]
    if not product.rating and schema_data.get("rating"):
        try:
            product.rating = float(schema_data["rating"])
        except (ValueError, TypeError):
            pass
    if not product.reviews_count and schema_data.get("review_count"):
        try:
            product.reviews_count = int(schema_data["review_count"])
        except (ValueError, TypeError):
            pass

    return product
