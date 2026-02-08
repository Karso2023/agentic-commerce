import math
from datetime import date

from models.schemas import (
    Product,
    ItemSpec,
    Constraints,
    ScoredProduct,
    ScoreBreakdown,
    LikedSnapshot,
)


def _user_preference_score(product: Product, liked_snapshots: list[LikedSnapshot]) -> float:
    """0-5 score: boost products similar to user's liked items (retailer + price similarity)."""
    if not liked_snapshots:
        return 0.0
    preferred_retailers = {s.retailer.lower() for s in liked_snapshots if s.retailer}
    avg_liked_price = sum(s.price for s in liked_snapshots) / max(len(liked_snapshots), 1)
    retailer_match = 1.0 if (product.retailer or "").lower() in preferred_retailers else 0.0
    if avg_liked_price <= 0:
        price_sim = 0.5
    else:
        price_diff = abs(product.price - avg_liked_price) / avg_liked_price
        price_sim = max(0, 1.0 - price_diff)
    # Cosine-style blend: weight retailer and price
    raw = 0.6 * retailer_match + 0.4 * price_sim
    return round(min(5.0, raw * 5), 1)


def score_product(
    product: Product,
    item_spec: ItemSpec,
    constraints: Constraints,
    current_cart: list[Product],
    num_categories: int,
    liked_snapshots: list[LikedSnapshot] | None = None,
) -> ScoredProduct:
    """Score a product using the transparent weighted algorithm.

    Weights: Reviews 35%, Price 25%, Delivery 25%, Preference 10%, Coherence 5%
    """
    budget_per_item = constraints.budget.total / max(num_categories, 1)

    # --- REVIEW SCORE (35%) ---
    if product.rating and product.reviews_count:
        rating_norm = product.rating / 5.0
        volume_confidence = min(
            1.0, math.log(product.reviews_count + 1) / math.log(500)
        )
        review_score = 0.7 * rating_norm + 0.3 * volume_confidence
    else:
        review_score = 0.3  # penalty for no reviews

    # --- PRICE SCORE (25%) ---
    price_ratio = product.price / max(budget_per_item, 1)
    if price_ratio <= 1.0:
        price_score = 1.0 - (price_ratio * 0.5)
    else:
        price_score = max(0, 1.0 - (price_ratio - 1.0))

    # Bonus for sale items
    if product.original_price and product.original_price > product.price:
        discount_pct = (product.original_price - product.price) / product.original_price
        price_score = min(1.0, price_score + discount_pct * 0.2)

    # --- DELIVERY SCORE (25%) ---
    if product.delivery_days is not None:
        days_until_deadline = (constraints.delivery_deadline - date.today()).days
        if product.delivery_days <= days_until_deadline:
            delivery_score = 1.0
        elif product.delivery_days <= days_until_deadline + 2:
            delivery_score = 0.5
        else:
            delivery_score = 0.1
    else:
        delivery_score = 0.4

    if product.delivery_cost == 0:
        delivery_score = min(1.0, delivery_score + 0.1)

    # --- PREFERENCE MATCH (10%) ---
    if item_spec.requirements:
        searchable = (
            product.name
            + " "
            + (product.description or "")
            + " "
            + " ".join(product.highlights)
        ).lower()
        matched = sum(1 for req in item_spec.requirements if req.lower() in searchable)
        pref_score = matched / len(item_spec.requirements)
        if pref_score == 0:
            pref_score = 0.1  # minimum so "preference" is never 0/10 (we considered it)
    else:
        pref_score = 0.5  # no requirements -> neutral 5/10

    # --- SET COHERENCE (5%) ---
    coherence_score = 0.5
    if current_cart:
        cart_brands = [p.brand for p in current_cart if p.brand]
        if product.brand and product.brand in cart_brands:
            coherence_score += 0.3
        cart_colors = set()
        for p in current_cart:
            for c in p.colors:
                cart_colors.add(c.lower())
        if product.colors:
            product_colors = {c.lower() for c in product.colors}
            if cart_colors & product_colors:
                coherence_score += 0.2
        coherence_score = min(1.0, coherence_score)

    # --- USER PREFERENCE / RECOMMENDER (5%) ---
    user_pref = _user_preference_score(product, liked_snapshots or [])

    # --- COMPOSITE (total max 105 with user_preference) ---
    total = (
        0.35 * review_score
        + 0.25 * price_score
        + 0.25 * delivery_score
        + 0.10 * pref_score
        + 0.05 * coherence_score
        + (user_pref / 5.0) * 0.05
    )

    return ScoredProduct(
        product=product,
        total_score=round(total * 100, 1),
        breakdown=ScoreBreakdown(
            reviews=round(review_score * 35, 1),
            price=round(price_score * 25, 1),
            delivery=round(delivery_score * 25, 1),
            preference=round(pref_score * 10, 1),
            coherence=round(coherence_score * 5, 1),
            user_preference=user_pref,
        ),
    )


def rank_products(
    products: list[Product],
    item_spec: ItemSpec,
    constraints: Constraints,
    current_cart: list[Product],
    num_categories: int,
    liked_snapshots: list[LikedSnapshot] | None = None,
) -> list[ScoredProduct]:
    """Score and rank a list of products. Returns sorted by total_score descending."""
    liked = liked_snapshots or []
    scored = [
        score_product(product, item_spec, constraints, current_cart, num_categories, liked)
        for product in products
    ]
    scored.sort(key=lambda s: s.total_score, reverse=True)
    for i, sp in enumerate(scored):
        sp.rank = i + 1
    return scored
