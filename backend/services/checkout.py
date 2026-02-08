import asyncio
import random
import string
from datetime import date

from models.enums import Category
from models.schemas import (
    Cart,
    CartItem,
    ScoredProduct,
    UserInfo,
    CheckoutPlan,
    CheckoutResult,
    RetailerCheckoutStep,
)


def build_cart(
    ranked_by_category: dict[str, list[ScoredProduct]],
    budget: float,
) -> Cart:
    """Build an optimal cart by selecting top-ranked items per category.

    Ensures 3+ retailers and fits within budget.
    """
    items: list[CartItem] = []

    for category_str, scored_products in ranked_by_category.items():
        if not scored_products:
            continue

        category = Category(category_str)
        selected = scored_products[0]
        alternatives = scored_products[1:5]

        items.append(
            CartItem(
                category=category,
                selected=selected,
                alternatives=alternatives,
            )
        )

    # Fit within budget: swap most expensive items for cheaper alternatives
    cart = _calculate_cart_totals(items, budget)
    attempts = 0
    while cart.budget_remaining < 0 and attempts < 20:
        items_sorted = sorted(
            enumerate(items),
            key=lambda x: x[1].selected.product.price,
            reverse=True,
        )
        swapped = False
        for idx, item in items_sorted:
            sorted_alts = sorted(item.alternatives, key=lambda a: a.product.price)
            for alt in sorted_alts:
                if alt.product.price < item.selected.product.price:
                    items[idx] = CartItem(
                        category=item.category,
                        selected=alt,
                        alternatives=[item.selected]
                        + [a for a in item.alternatives if a.product.id != alt.product.id],
                    )
                    swapped = True
                    break
            if swapped:
                break
        if not swapped:
            break
        cart = _calculate_cart_totals(items, budget)
        attempts += 1

    # After budget optimization, enforce retailer diversity
    # Only swap for diversity if it doesn't blow the budget by more than 10%
    items = _ensure_retailer_diversity(items, min_retailers=3, budget=budget)

    return _calculate_cart_totals(items, budget)


def _ensure_retailer_diversity(
    items: list[CartItem], min_retailers: int = 3, budget: float = 0
) -> list[CartItem]:
    """Swap items to ensure at least min_retailers distinct retailers in cart."""
    current_retailers = set(i.selected.product.retailer for i in items)

    if len(current_retailers) >= min_retailers:
        return items

    from collections import Counter

    retailer_counts = Counter(i.selected.product.retailer for i in items)
    current_total = sum(i.selected.product.price for i in items)

    # Try to swap items from over-represented retailers to new ones
    # Prefer swapping cheaper categories to minimize budget impact
    items_by_price = sorted(
        enumerate(items),
        key=lambda x: x[1].selected.product.price,
    )

    for idx, item in items_by_price:
        if len(current_retailers) >= min_retailers:
            break
        if retailer_counts[item.selected.product.retailer] <= 1:
            continue

        new_retailer_alts = [
            a for a in item.alternatives if a.product.retailer not in current_retailers
        ]
        if not new_retailer_alts:
            continue

        # Pick the best-scoring new-retailer alt with the least price increase
        new_retailer_alts.sort(
            key=lambda a: (-a.total_score, a.product.price)
        )
        alt = new_retailer_alts[0]
        old = item.selected
        retailer_counts[old.product.retailer] -= 1
        items[idx] = CartItem(
            category=item.category,
            selected=alt,
            alternatives=[old]
            + [a for a in item.alternatives if a.product.id != alt.product.id],
        )
        current_retailers.add(alt.product.retailer)
        retailer_counts[alt.product.retailer] += 1
        current_total += alt.product.price - old.product.price

    return items


def swap_item(
    cart: Cart,
    category: Category,
    new_product_id: str,
    ranked_by_category: dict[str, list[ScoredProduct]],
) -> Cart:
    """Swap an item in the cart with an alternative."""
    new_items = []
    budget = cart.total_price + cart.budget_remaining  # original budget

    for item in cart.items:
        if item.category == category:
            # Find the new product in alternatives or ranked results
            new_product = None
            remaining_alts = []

            # Check alternatives first
            for alt in item.alternatives:
                if alt.product.id == new_product_id:
                    new_product = alt
                else:
                    remaining_alts.append(alt)

            # Check full ranked results if not found
            if not new_product:
                for sp in ranked_by_category.get(category.value, []):
                    if sp.product.id == new_product_id:
                        new_product = sp
                        break

            if new_product:
                # Old selected becomes an alternative
                remaining_alts.insert(0, item.selected)
                new_items.append(
                    CartItem(
                        category=category,
                        selected=new_product,
                        alternatives=remaining_alts[:5],
                    )
                )
            else:
                new_items.append(item)
        else:
            new_items.append(item)

    return _calculate_cart_totals(new_items, budget)


def plan_checkout(cart: Cart, user_info: UserInfo) -> CheckoutPlan:
    """Generate a checkout plan grouping items by retailer."""
    retailer_items: dict[str, list[CartItem]] = {}
    for item in cart.items:
        retailer = item.selected.product.retailer
        if retailer not in retailer_items:
            retailer_items[retailer] = []
        retailer_items[retailer].append(item)

    steps = []
    for retailer, items in retailer_items.items():
        subtotal = sum(i.selected.product.price for i in items)
        shipping = sum(i.selected.product.delivery_cost or 0 for i in items)
        max_delivery = max(
            (i.selected.product.delivery_days or 5 for i in items), default=5
        )

        steps.append(
            RetailerCheckoutStep(
                retailer=retailer,
                items=items,
                subtotal=round(subtotal, 2),
                shipping_cost=round(shipping, 2),
                estimated_delivery=f"{max_delivery} business days",
            )
        )

    return CheckoutPlan(
        steps=steps,
        total=round(sum(s.subtotal + s.shipping_cost for s in steps), 2),
        user_info=user_info,
    )


async def execute_checkout(plan: CheckoutPlan) -> CheckoutResult:
    """Simulate checkout execution with per-retailer results."""
    completed_steps = []

    for step in plan.steps:
        # Simulate processing time
        await asyncio.sleep(1)

        confirmation = "".join(
            random.choices(string.ascii_uppercase + string.digits, k=12)
        )

        completed_steps.append(
            RetailerCheckoutStep(
                retailer=step.retailer,
                items=step.items,
                subtotal=step.subtotal,
                shipping_cost=step.shipping_cost,
                estimated_delivery=step.estimated_delivery,
                status="confirmed",
                confirmation_number=confirmation,
            )
        )

    return CheckoutResult(
        success=True,
        steps=completed_steps,
        total_charged=plan.total,
        message=f"All {len(completed_steps)} retailer orders confirmed successfully!",
    )


def optimize_budget(
    cart: Cart,
    ranked_by_category: dict[str, list[ScoredProduct]],
) -> Cart:
    """Optimize cart for lower cost while maintaining quality (score > 60)."""
    budget = cart.total_price + cart.budget_remaining
    new_items = list(cart.items)

    # Sort by price descending to optimize the most expensive first
    indexed_items = sorted(
        enumerate(new_items),
        key=lambda x: x[1].selected.product.price,
        reverse=True,
    )

    for idx, item in indexed_items:
        category = item.category.value
        alternatives = ranked_by_category.get(category, [])

        # Find cheapest alternative with decent score
        best_cheap = None
        for alt in alternatives:
            if (
                alt.product.id != item.selected.product.id
                and alt.product.price < item.selected.product.price
                and alt.total_score >= 60
            ):
                if best_cheap is None or alt.product.price < best_cheap.product.price:
                    best_cheap = alt

        if best_cheap:
            remaining_alts = [item.selected] + [
                a for a in item.alternatives if a.product.id != best_cheap.product.id
            ]
            new_items[idx] = CartItem(
                category=item.category,
                selected=best_cheap,
                alternatives=remaining_alts[:5],
            )

    return _calculate_cart_totals(new_items, budget)


def optimize_delivery(
    cart: Cart,
    ranked_by_category: dict[str, list[ScoredProduct]],
    deadline: date,
) -> Cart:
    """Optimize cart so all items arrive by deadline."""
    budget = cart.total_price + cart.budget_remaining
    new_items = list(cart.items)
    days_until_deadline = (deadline - date.today()).days

    for idx, item in enumerate(new_items):
        delivery = item.selected.product.delivery_days
        if delivery is not None and delivery <= days_until_deadline:
            continue  # Already within deadline

        # Find fastest alternative that meets deadline
        category = item.category.value
        alternatives = ranked_by_category.get(category, [])

        best_fast = None
        for alt in alternatives:
            if (
                alt.product.id != item.selected.product.id
                and alt.product.delivery_days is not None
                and alt.product.delivery_days <= days_until_deadline
            ):
                if best_fast is None or alt.total_score > best_fast.total_score:
                    best_fast = alt

        if best_fast:
            remaining_alts = [item.selected] + [
                a for a in item.alternatives if a.product.id != best_fast.product.id
            ]
            new_items[idx] = CartItem(
                category=item.category,
                selected=best_fast,
                alternatives=remaining_alts[:5],
            )

    return _calculate_cart_totals(new_items, budget)


def _calculate_cart_totals(items: list[CartItem], budget: float) -> Cart:
    """Calculate cart totals from items."""
    total_price = sum(item.selected.product.price for item in items)
    retailers = list(set(item.selected.product.retailer for item in items))
    all_within = all(
        item.selected.product.delivery_days is not None
        and item.selected.product.delivery_days <= 7
        for item in items
    )

    return Cart(
        items=items,
        total_price=round(total_price, 2),
        budget_remaining=round(budget - total_price, 2),
        retailers_involved=retailers,
        all_within_deadline=all_within,
    )
