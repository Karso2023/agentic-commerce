import asyncio
from datetime import date
from fastapi import APIRouter, Request, HTTPException

from config import settings
from models.schemas import (
    UserMessage,
    ShoppingSpec,
    RankRequest,
    SwapRequest,
    ExplainRequest,
    UserInfo,
    CheckoutPlan,
    Cart,
)
from security import sanitize_input, is_valid_product_url, url_page_exists
from services.url_validator import get_first_valid_compared_product, product_url_still_valid
from services.intent_parser import parse_intent
from services.discovery import discover_products
from services.ranking import rank_products
from services.explainer import explain_ranking
from services.checkout import (
    build_cart,
    swap_item,
    plan_checkout,
    execute_checkout,
    optimize_budget,
    optimize_delivery,
)
from services.scraper import extract_schema_product

router = APIRouter(prefix="/api")

# In-memory session store for hackathon simplicity
_sessions: dict[str, dict] = {}


def _get_session(session_id: str = "default") -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {"ranked": {}, "spec": None}
    return _sessions[session_id]


@router.post("/parse-intent")
async def api_parse_intent(body: UserMessage):
    result = await parse_intent(body.message)
    return result


@router.post("/discover")
async def api_discover(spec: ShoppingSpec):
    products_by_category = await discover_products(spec)
    session = _get_session()
    session["spec"] = spec
    return {"products_by_category": products_by_category}


@router.post("/rank")
async def api_rank(request: RankRequest):
    spec = request.spec
    num_categories = len(spec.items_needed)
    ranked_by_category: dict = {}
    current_cart_products = []

    # Build item_spec lookup
    item_specs = {item.category.value: item for item in spec.items_needed}

    # Rank must_have categories first, then nice_to_have
    sorted_categories = sorted(
        request.discovery_results.products_by_category.items(),
        key=lambda x: (
            0
            if item_specs.get(x[0], None)
            and item_specs[x[0]].priority.value == "must_have"
            else 1
        ),
    )

    for category_str, products in sorted_categories:
        item_spec = item_specs.get(category_str)
        if not item_spec:
            from models.enums import Category, Priority
            from models.schemas import ItemSpec

            item_spec = ItemSpec(
                category=Category(category_str),
                priority=Priority.NICE_TO_HAVE,
                requirements=[],
            )

        ranked = rank_products(
            products, item_spec, spec.constraints, current_cart_products, num_categories,
            liked_snapshots=request.liked_snapshots or None,
        )
        ranked_by_category[category_str] = ranked

        # Add top product to current_cart for coherence scoring of subsequent categories
        if ranked:
            current_cart_products.append(ranked[0].product)

    # Store in session for swap/optimize
    session = _get_session()
    session["ranked"] = ranked_by_category
    session["spec"] = spec

    return {"ranked_by_category": ranked_by_category, "spec": spec}


@router.post("/cart/build")
async def api_build_cart(request: dict):
    ranked_by_category = request.get("ranked_by_category", {})
    spec = request.get("spec")

    # Reconstruct ScoredProduct objects from dict data
    from models.schemas import ScoredProduct

    parsed_ranked: dict[str, list[ScoredProduct]] = {}
    for cat, products in ranked_by_category.items():
        parsed_ranked[cat] = [ScoredProduct.model_validate(p) for p in products]

    budget = spec["constraints"]["budget"]["total"] if spec else 400.0
    cart = build_cart(parsed_ranked, budget)

    session = _get_session()
    session["ranked"] = parsed_ranked

    return cart


@router.post("/cart/add-item")
async def api_add_item_to_cart(body: dict):
    """Add a single product to the cart by URL. Re-fetches current price and validates page is still available."""
    import hashlib
    from urllib.parse import urlparse
    from models.enums import Category
    from models.schemas import Product, ScoredProduct, ScoreBreakdown
    from services.scraper import extract_schema_product
    from services.checkout import build_cart

    url = body.get("product_url") or body.get("url")
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="product_url is required")
    if not is_valid_product_url(url):
        raise HTTPException(status_code=400, detail="Invalid product URL")
    if not await asyncio.to_thread(product_url_still_valid, url):
        raise HTTPException(
            status_code=400,
            detail="Product no longer available or page unavailable",
        )

    schema = await asyncio.to_thread(extract_schema_product, url.strip())
    if not schema:
        raise HTTPException(status_code=422, detail="Could not fetch product details from page")

    name = schema.get("name") or "Product"
    try:
        price = float(schema.get("price") or 0)
    except (TypeError, ValueError):
        price = 0.0
    domain = urlparse(url).netloc or "unknown"
    retailer = domain.replace("www.", "").split(".")[0].title()
    product_id = "custom_" + hashlib.sha256(url.encode()).hexdigest()[:12]

    product = Product(
        id=product_id,
        name=name,
        retailer=retailer,
        price=price,
        image_url=schema.get("image"),
        product_url=url,
        brand=schema.get("brand"),
        description=schema.get("description"),
    )
    breakdown = ScoreBreakdown(
        reviews=17.5, price=12.5, delivery=12.5, preference=5, coherence=2.5, user_preference=0
    )
    scored = ScoredProduct(
        product=product,
        total_score=50.0,
        breakdown=breakdown,
        rank=1,
    )

    session = _get_session()
    ranked = session.get("ranked") or {}
    spec = session.get("spec")
    budget = spec.constraints.budget.total if spec else 1000.0

    cat_key = "custom"
    if cat_key not in ranked:
        ranked[cat_key] = []
    ranked[cat_key].insert(0, scored)
    session["ranked"] = ranked

    cart = build_cart(ranked, budget)
    ranked_dump = {k: [p.model_dump() for p in v] for k, v in ranked.items()}
    minimal_spec = {
        "scenario": "custom",
        "items_needed": [],
        "constraints": {
            "budget": {"total": budget, "currency": "USD"},
            "size": "N/A",
            "delivery_deadline": date.today().isoformat(),
            "style_preferences": [],
            "brand_preferences": [],
            "color_preferences": [],
        },
    }
    spec_dump = spec.model_dump() if spec else minimal_spec
    return {
        "cart": cart.model_dump(),
        "ranked_by_category": ranked_dump,
        "spec": spec_dump,
    }


@router.post("/cart/swap")
async def api_swap_item(request: SwapRequest):
    session = _get_session(request.session_id)
    ranked = session.get("ranked", {})

    # We need the current cart - rebuild it from ranked data
    spec = session.get("spec")
    budget = spec.constraints.budget.total if spec else 400.0
    cart = build_cart(ranked, budget)

    updated_cart = swap_item(cart, request.category, request.new_product_id, ranked)
    return updated_cart


@router.post("/explain")
async def api_explain(request: ExplainRequest):
    session = _get_session(request.session_id)
    ranked = session.get("ranked", {})
    spec = session.get("spec")

    category_products = ranked.get(request.category.value, [])
    product = None
    for sp in category_products:
        if sp.product.id == request.product_id:
            product = sp
            break

    if not product:
        return {
            "product_id": request.product_id,
            "category": request.category,
            "explanation": "Product not found.",
            "compared_product_name": None,
            "compared_product_url": None,
        }

    # Compared product: first alternative (by rank) whose URL is valid and page does not show "no longer available"
    compared_validated = await asyncio.to_thread(
        get_first_valid_compared_product, category_products, request.product_id
    )
    compared = compared_validated
    if compared is None and len(category_products) > 1:
        compared = next((sp for sp in category_products if sp.product.id != request.product_id), None)

    num_categories = len(spec.items_needed) if spec else 4
    explanation = await explain_ranking(
        product,
        request.category,
        product.rank,
        spec.constraints if spec else None,
        num_categories,
        compared_product=compared,
    )

    # Only expose link when we used a validated product (never show unvalidated fallback URL)
    compared_name = compared.product.name if compared else None
    compared_url = (
        compared_validated.product.product_url
        if compared_validated and is_valid_product_url(compared_validated.product.product_url)
        else None
    )
    return {
        "product_id": request.product_id,
        "category": request.category,
        "explanation": explanation,
        "compared_product_name": compared_name,
        "compared_product_url": compared_url,
    }


@router.post("/checkout/plan")
async def api_checkout_plan(request: dict):
    cart = Cart.model_validate(request["cart"])
    user_info = UserInfo.model_validate(request["user_info"])
    plan = plan_checkout(cart, user_info)
    return plan


@router.post("/checkout/execute")
async def api_execute_checkout(plan: CheckoutPlan):
    result = await execute_checkout(plan)
    return result


@router.post("/optimize/budget")
async def api_optimize_budget(cart: Cart):
    session = _get_session()
    ranked = session.get("ranked", {})
    optimized = optimize_budget(cart, ranked)
    return optimized


@router.post("/optimize/delivery")
async def api_optimize_delivery(request: dict):
    cart = Cart.model_validate(request["cart"])
    deadline_str = request.get("deadline")
    deadline = date.fromisoformat(deadline_str) if deadline_str else date.today()

    session = _get_session()
    ranked = session.get("ranked", {})
    optimized = optimize_delivery(cart, ranked, deadline)
    return optimized


@router.post("/product-details")
async def api_product_details(body: dict):
    """Fetch product details from retailer page. Validates URL and that page is not 'no longer available'."""
    url = body.get("url")
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="url is required")
    if not is_valid_product_url(url):
        return {"exists": False, "details": None, "error": "Invalid URL"}
    # Content check: avoid returning success for "Product no longer exists" pages
    if not await asyncio.to_thread(product_url_still_valid, url):
        return {"exists": False, "details": None, "error": "Product no longer available or page unavailable"}
    try:
        details = extract_schema_product(url.strip())
        return {"exists": True, "details": details}
    except Exception as e:
        return {"exists": True, "details": None, "error": str(e)}
