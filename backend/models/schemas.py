from __future__ import annotations

from datetime import date
from pydantic import BaseModel, Field

from models.enums import Category, Priority


# --- Intent Parsing ---


class ItemSpec(BaseModel):
    category: Category
    priority: Priority
    requirements: list[str] = []


class Budget(BaseModel):
    total: float
    currency: str = "USD"


class Constraints(BaseModel):
    budget: Budget
    size: str
    delivery_deadline: date
    style_preferences: list[str] = []
    brand_preferences: list[str] = []
    color_preferences: list[str] = []


class ShoppingSpec(BaseModel):
    scenario: str = "skiing_outfit"
    items_needed: list[ItemSpec]
    constraints: Constraints


class UserMessage(BaseModel):
    message: str = Field(..., max_length=500)


class ConversationTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ParseIntentRequest(BaseModel):
    message: str = Field(..., max_length=500)
    history: list[ConversationTurn] = []


class ClarifyingQuestion(BaseModel):
    question: str
    is_clarification: bool = True


# --- Products ---


class Product(BaseModel):
    id: str
    name: str
    retailer: str
    price: float
    original_price: float | None = None
    rating: float | None = None
    reviews_count: int | None = None
    delivery_days: int | None = None
    delivery_cost: float | None = None
    delivery_text: str | None = None
    sizes: list[str] = []
    colors: list[str] = []
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    product_url: str | None = None
    highlights: list[str] = []


# --- Scoring ---


class ScoreBreakdown(BaseModel):
    reviews: float = Field(description="Out of 35")
    price: float = Field(description="Out of 25")
    delivery: float = Field(description="Out of 25")
    preference: float = Field(description="Out of 10")
    coherence: float = Field(description="Out of 5")
    user_preference: float = Field(default=0, description="Out of 5 — recommender from liked items")


class ScoredProduct(BaseModel):
    product: Product
    total_score: float = Field(description="0-100")
    breakdown: ScoreBreakdown
    max_possible: dict[str, float] = {
        "reviews": 35,
        "price": 25,
        "delivery": 25,
        "preference": 10,
        "coherence": 5,
        "user_preference": 5,
    }
    rank: int = 0
    explanation: str | None = None


# --- Cart ---


class CartItem(BaseModel):
    category: Category
    selected: ScoredProduct
    alternatives: list[ScoredProduct] = []


class Cart(BaseModel):
    items: list[CartItem]
    total_price: float
    budget_remaining: float
    retailers_involved: list[str]
    all_within_deadline: bool


# --- Discovery & Ranking ---


class DiscoveryResults(BaseModel):
    products_by_category: dict[str, list[Product]]


class LikedSnapshot(BaseModel):
    """Minimal product snapshot from user's liked list for recommender."""
    id: str = ""
    name: str = ""
    retailer: str = ""
    price: float = 0.0


class RankRequest(BaseModel):
    discovery_results: DiscoveryResults
    spec: ShoppingSpec
    liked_snapshots: list[LikedSnapshot] | None = None


class RankedResults(BaseModel):
    ranked_by_category: dict[str, list[ScoredProduct]]
    spec: ShoppingSpec


# --- Swap ---


class SwapRequest(BaseModel):
    category: Category
    new_product_id: str
    session_id: str = "default"


# --- Explanation ---


class ExplainRequest(BaseModel):
    product_id: str
    category: Category
    session_id: str = "default"


class Explanation(BaseModel):
    product_id: str
    category: Category
    explanation: str
    compared_product_name: str | None = None
    compared_product_url: str | None = None


# --- Checkout ---


class UserInfo(BaseModel):
    full_name: str
    email: str
    address_line1: str
    address_line2: str = ""
    city: str
    state: str
    zip_code: str
    country: str = "US"
    card_last_four: str = ""


class RetailerCheckoutStep(BaseModel):
    retailer: str
    items: list[CartItem]
    subtotal: float
    shipping_cost: float
    estimated_delivery: str
    status: str = "pending"
    confirmation_number: str | None = None


class CheckoutPlan(BaseModel):
    steps: list[RetailerCheckoutStep]
    total: float
    user_info: UserInfo
    session_id: str = "default"


class CheckoutResult(BaseModel):
    success: bool
    steps: list[RetailerCheckoutStep]
    total_charged: float
    message: str
