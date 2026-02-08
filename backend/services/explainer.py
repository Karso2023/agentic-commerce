import logging

from config import settings
from models.schemas import ScoredProduct, Constraints
from models.enums import Category
from security import build_hardened_system_prompt, wrap_user_input

logger = logging.getLogger(__name__)

EXPLAINER_SYSTEM_PROMPT = build_hardened_system_prompt("""You are a shopping assistant that explains why a chosen product is the best pick (rank #1).

Given the chosen product and optionally another product it was compared to, write a concise 2–3 sentence explanation of why this product is better for the customer.

Reference specific factors: price, delivery, reviews, preference match, set coherence. If comparing to another product, say clearly why this one wins (e.g. better price, faster delivery, higher ratings).

Be factual and helpful. Do not use marketing language.

Respond with ONLY the explanation text. No JSON, no formatting, no extra commentary.""")


async def explain_ranking(
    scored_product: ScoredProduct,
    category: Category,
    rank: int,
    constraints: Constraints,
    num_categories: int,
    compared_product: ScoredProduct | None = None,
) -> str:
    """Generate a human-readable explanation for a product's ranking."""
    budget_per_item = constraints.budget.total / max(num_categories, 1)

    if settings.MOCK_MODE or not settings.OPENAI_API_KEY:
        return _template_explanation(scored_product, category, rank, budget_per_item, compared_product)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        compare_block = ""
        if compared_product:
            cp = compared_product.product
            compare_block = (
                f"\nCompared to (alternative): {cp.name} from {cp.retailer}, "
                f"price ${cp.price}, delivery: {cp.delivery_text or 'N/A'}. "
                f"Explain why the chosen product is better."
            )

        user_content = wrap_user_input(
            f"Chosen product (rank #1): {scored_product.product.name} from {scored_product.product.retailer}\n"
            f"Price: ${scored_product.product.price}, Delivery: {scored_product.product.delivery_text or 'N/A'}\n"
            f"Score: {scored_product.total_score}/100\n"
            f"Breakdown: reviews={scored_product.breakdown.reviews}/35, "
            f"price={scored_product.breakdown.price}/25, "
            f"delivery={scored_product.breakdown.delivery}/25, "
            f"preference={scored_product.breakdown.preference}/10, "
            f"coherence={scored_product.breakdown.coherence}/5\n"
            f"Category: {category.value}\n"
            f"Budget per item: ${budget_per_item:.2f}, Delivery deadline: {constraints.delivery_deadline}"
            f"{compare_block}"
        )

        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=200,
            messages=[
                {"role": "system", "content": EXPLAINER_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        )

        explanation = response.choices[0].message.content.strip()
        if len(explanation) > 500:
            explanation = explanation[:500]
        return explanation

    except Exception as e:
        logger.error(f"OpenAI API error in explain_ranking: {e}")
        return _template_explanation(scored_product, category, rank, budget_per_item, compared_product)


def _template_explanation(
    scored: ScoredProduct,
    category: Category,
    rank: int,
    budget_per_item: float,
    compared_product: ScoredProduct | None = None,
) -> str:
    """Generate a template-based explanation as fallback."""
    p = scored.product
    b = scored.breakdown

    # Find the strongest and weakest factors
    factors = {
        "reviews": (b.reviews, 35),
        "price": (b.price, 25),
        "delivery": (b.delivery, 25),
        "preference match": (b.preference, 10),
        "set coherence": (b.coherence, 5),
    }
    strongest = max(factors.items(), key=lambda x: x[1][0] / x[1][1])
    weakest = min(factors.items(), key=lambda x: x[1][0] / x[1][1])

    strength_pct = round(strongest[1][0] / strongest[1][1] * 100)
    weakness_pct = round(weakest[1][0] / weakest[1][1] * 100)

    sentence1 = (
        f"Ranked #{rank} for {category.value.replace('_', ' ')} with a score of "
        f"{scored.total_score}/100. "
    )

    if compared_product:
        cp = compared_product.product
        sentence2 = (
            f"Compared to {cp.name} from {cp.retailer} (${cp.price}), "
            f"this option wins on {strongest[0]} ({strength_pct}%) and fits your budget and delivery needs better."
        )
    else:
        sentence2 = (
            f"Strongest in {strongest[0]} ({strength_pct}%), "
            f"while {weakest[0]} ({weakness_pct}%) offers room for improvement."
        )

    return sentence1 + sentence2
