# Agentic Commerce — Skiing Outfit Agent

## Project Overview

Build an end-to-end **agentic commerce** system for **Option B: Skiing Outfit** from the Hack-Nation Global AI Hackathon (VC Track). This is NOT a recommendation chatbot — it is a full shopping agent that understands intent, discovers products across 3+ retailers, ranks them transparently, builds a combined cart, and orchestrates simulated checkout.

**Scenario:** "Downhill skiing outfit, warm and waterproof, size M, budget $400, delivery within 5 days."

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | **Next.js 16** + **shadcn/ui** + **Lucide React** + Tailwind CSS | App Router, React Server Components where useful |
| Backend | **FastAPI** (Python) | Async endpoints, handles scraping + ranking + LLM calls |
| AI/LLM | **Claude API** (Sonnet 4) | Intent parsing, spec generation, explanation generation |
| Product Data | **SerpAPI** (Google Shopping + Immersive Product) + **BeautifulSoup** + **Mock data** | 3-layer hybrid strategy |
| State | In-memory / JSON files | No DB overhead for hackathon |
| Package Manager | pnpm (frontend), pip/uv (backend) |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (Next.js 16 + shadcn/ui + Lucide)     │
│  - Chat UI (conversational brief capture)       │
│  - Combined Cart View (multi-retailer)          │
│  - Score Breakdown Panel (transparency)         │
│  - Checkout Flow (simulated)                    │
└────────────────────┬────────────────────────────┘
                     │ REST / fetch
┌────────────────────▼────────────────────────────┐
│  Backend (FastAPI)                               │
│  - POST /api/parse-intent     → Claude API      │
│  - POST /api/discover         → Product search  │
│  - POST /api/rank             → Scoring engine  │
│  - POST /api/checkout         → Simulated       │
│  - POST /api/explain          → Claude API      │
│  - POST /api/optimize         → Budget/delivery │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Data Layer                                      │
│  [1] SerpAPI Google Shopping → discovery         │
│  [2] SerpAPI Immersive Product → detail + stores │
│  [3] BeautifulSoup Schema.org → supplementary    │
│  [4] Mock retailer JSON → fallback guarantee     │
└─────────────────────────────────────────────────┘
```

---

## Product Data Strategy (3-Layer Hybrid)

### Layer 1: SerpAPI Google Shopping (Primary Discovery)

Search Google Shopping for each outfit category. Returns multi-retailer results automatically.

```python
import serpapi

params = {
    "api_key": SERPAPI_KEY,
    "engine": "google_shopping",
    "q": "waterproof ski jacket men size M",
    "tbs": "mr:1,price:1,ppr_min:50,ppr_max:200",
    "gl": "us",
    "hl": "en"
}
results = serpapi.search(params)
products = results.get("shopping_results", [])
```

**Fields returned per product:**
- `title` — product name
- `extracted_price` — numeric price
- `source` — retailer name (REI, Backcountry, Amazon, evo, etc.)
- `rating` — star rating
- `reviews` — review count
- `delivery` — delivery text (e.g. "Free delivery by Fri")
- `thumbnail` — product image URL
- `product_id` — for drilling into Immersive Product API
- `immersive_product_page_token` — **use this for detail lookup**
- `extracted_old_price` — original price if on sale

### Layer 2: SerpAPI Google Immersive Product (Detail + Multi-Store Pricing)

> **IMPORTANT:** Google Product API is DISCONTINUED. Use **Google Immersive Product API** instead.

After getting `immersive_product_page_token` from Shopping results, fetch full product details:

```python
params = {
    "api_key": SERPAPI_KEY,
    "engine": "google_immersive_product",
    "page_token": token_from_shopping_results,
    "more_stores": "true"  # Get up to 13 stores instead of default 3-5
}
detail = serpapi.search(params)
product_results = detail.get("product_results", {})
```

**Immersive Product returns:**
- `product_results.title` — full product title
- `product_results.prices` — price from headline store
- `product_results.rating` — rating
- `product_results.reviews` — review count
- `product_results.media` — array of images
- `product_results.highlights` — feature bullets
- `product_results.description` — full description
- `product_results.stores` — **array of stores selling this product**, each with:
  - `name` — store name (e.g. "Walmart", "REI", "Backcountry")
  - `link` — direct purchase link
  - `price` / `extracted_price` — store price
  - `original_price` / `extracted_original_price` — pre-discount price
  - `shipping` / `shipping_extracted` — shipping cost
  - `total` / `extracted_total` — total with shipping
  - `rating` — store-specific rating
  - `reviews` — store-specific review count
  - `tag` — e.g. "Best price", "Trusted store"
  - `details_and_offers` — array of delivery/return info strings
  - `payment_methods` — accepted payment methods
  - `discount` — e.g. "20% off"
- `product_results.sizes` — available sizes with links
- `product_results.colors` — available colors with links
- `product_results.specifications` — product specs
- `product_results.reviews_results` — detailed review breakdown
- `stores_next_page_token` — for paginating more stores

**Two-step flow:**
1. `google_shopping` → get list of products with `immersive_product_page_token`
2. `google_immersive_product` → get full details + all stores + reviews for top candidates

### Layer 3: Direct Scraping — Schema.org JSON-LD (Supplementary)

Many retailers embed structured data. Extract it as supplementary/fallback:

```python
import requests, json
from bs4 import BeautifulSoup

def extract_schema_product(url: str) -> dict | None:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    resp = requests.get(url, headers=headers, timeout=10)
    soup = BeautifulSoup(resp.text, "html.parser")
    
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            # Handle both single object and array
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") == "Product":
                    return {
                        "name": item.get("name"),
                        "price": item.get("offers", {}).get("price"),
                        "currency": item.get("offers", {}).get("priceCurrency"),
                        "availability": item.get("offers", {}).get("availability"),
                        "rating": item.get("aggregateRating", {}).get("ratingValue"),
                        "review_count": item.get("aggregateRating", {}).get("reviewCount"),
                        "brand": item.get("brand", {}).get("name"),
                        "description": item.get("description"),
                        "image": item.get("image"),
                    }
        except json.JSONDecodeError:
            continue
    return None
```

### Layer 4: Mock Retailer Data (Fallback Guarantee)

Always have realistic mock data ready. Structure:

```python
# data/mock_retailers.py
MOCK_DATA = {
    "jacket": [
        {
            "id": "rei-jacket-001",
            "name": "Arc'teryx Rush Jacket Men's",
            "retailer": "REI",
            "price": 189.99,
            "original_price": 299.99,
            "rating": 4.7,
            "reviews_count": 342,
            "delivery_days": 3,
            "delivery_cost": 0.0,
            "sizes": ["S", "M", "L", "XL"],
            "colors": ["Black", "Blue", "Red"],
            "waterproof": True,
            "warmth_rating": "High",
            "brand": "Arc'teryx",
            "image_url": "https://placeholder.example/jacket1.jpg",
            "product_url": "https://www.rei.com/product/example",
        },
        # ... more from Backcountry, evo, Amazon
    ],
    "pants": [...],
    "base_layer": [...],
    "gloves": [...],
    "goggles": [...],
    "helmet": [...],
    "socks": [...],
}
```

---

## AI Agent Pipeline

### Step 1: Conversational Brief Capture

Use Claude to parse user intent into a structured shopping spec.

**System prompt for Claude:**
```
You are a skiing outfit shopping assistant. Parse the user's message into a structured JSON shopping specification.

Output this exact JSON schema:
{
  "scenario": "skiing_outfit",
  "items_needed": [
    {
      "category": "jacket" | "pants" | "base_layer_top" | "base_layer_bottom" | "gloves" | "goggles" | "helmet" | "socks" | "neck_gaiter",
      "priority": "must_have" | "nice_to_have",
      "requirements": ["waterproof", "warm", "insulated", ...]
    }
  ],
  "constraints": {
    "budget": { "total": number, "currency": "USD" },
    "size": "XS" | "S" | "M" | "L" | "XL" | "XXL",
    "delivery_deadline": "YYYY-MM-DD",
    "style_preferences": [],
    "brand_preferences": [],
    "color_preferences": []
  }
}

If information is missing, ask ONE focused clarifying question. Don't ask multiple questions at once.

For a skiing outfit, always include at minimum: jacket, pants, gloves, goggles as must_have.
Base layers, helmet, socks, neck gaiter are nice_to_have unless user specifies otherwise.
```

### Step 2: Product Discovery

For each item in the spec, generate search queries and fetch from SerpAPI:

```python
async def discover_products(spec: ShoppingSpec) -> dict[str, list[Product]]:
    all_products = {}
    
    for item in spec.items_needed:
        query = build_query(item, spec.constraints)
        # e.g. "waterproof insulated ski jacket men size M"
        
        # SerpAPI Google Shopping
        shopping_results = await serpapi_shopping_search(
            query=query,
            price_max=spec.constraints.budget.total * 0.4  # no single item > 40% of budget
        )
        
        # For top 3-5 results, get Immersive Product details
        detailed = []
        for product in shopping_results[:5]:
            if product.immersive_product_page_token:
                detail = await serpapi_immersive_product(
                    page_token=product.immersive_product_page_token,
                    more_stores=True
                )
                detailed.append(merge_product_data(product, detail))
            else:
                detailed.append(product)
        
        all_products[item.category] = detailed
    
    return all_products
```

### Step 3: Ranking Engine (Transparent Scoring)

**CRITICAL: Not just LLM output. Algorithmic scoring with transparent weights.**

#### Scoring Weights (Updated per requirements)

| Factor | Weight | Rationale |
|--------|--------|-----------|
| **Review Score** | **35%** | Most important — reviews are the strongest signal of product quality |
| **Price Score** | **25%** | Equal importance with delivery |
| **Delivery Score** | **25%** | Equal importance with price |
| **Preference Match** | **10%** | Requirements fulfillment (waterproof, warm, etc.) |
| **Set Coherence** | **5%** | Bonus for brand/color consistency across outfit |

#### Scoring Implementation

```python
import math
from datetime import date

def score_product(
    product: Product,
    category: ItemSpec,
    constraints: Constraints,
    current_cart: list[Product]
) -> ScoredProduct:
    
    budget_per_item = constraints.budget.total / len(categories)
    
    # --- REVIEW SCORE (35%) ---
    # Combines rating quality with review volume confidence
    if product.rating and product.reviews_count:
        rating_norm = product.rating / 5.0
        # Log scale for review volume — diminishing returns after ~100 reviews
        volume_confidence = min(1.0, math.log(product.reviews_count + 1) / math.log(500))
        review_score = 0.7 * rating_norm + 0.3 * volume_confidence
    else:
        review_score = 0.3  # penalty for no reviews, not zero
    
    # --- PRICE SCORE (25%) ---
    # Lower price relative to budget allocation = better
    price_ratio = product.price / budget_per_item
    if price_ratio <= 1.0:
        price_score = 1.0 - (price_ratio * 0.5)  # Under budget is good
    else:
        price_score = max(0, 1.0 - (price_ratio - 1.0))  # Over budget penalized
    
    # Bonus for sale items
    if product.original_price and product.original_price > product.price:
        discount_pct = (product.original_price - product.price) / product.original_price
        price_score = min(1.0, price_score + discount_pct * 0.2)
    
    # --- DELIVERY SCORE (25%) ---
    # Binary: can it arrive by deadline?
    if product.delivery_days is not None:
        days_until_deadline = (constraints.delivery_deadline - date.today()).days
        if product.delivery_days <= days_until_deadline:
            delivery_score = 1.0
        elif product.delivery_days <= days_until_deadline + 2:
            delivery_score = 0.5  # close but risky
        else:
            delivery_score = 0.1  # won't make it
    else:
        delivery_score = 0.4  # unknown delivery = moderate penalty
    
    # Free shipping bonus
    if product.delivery_cost == 0:
        delivery_score = min(1.0, delivery_score + 0.1)
    
    # --- PREFERENCE MATCH (10%) ---
    if category.requirements:
        matched = sum(
            1 for req in category.requirements
            if req.lower() in (product.title + " " + (product.description or "")).lower()
        )
        pref_score = matched / len(category.requirements)
    else:
        pref_score = 0.5
    
    # --- SET COHERENCE (5%) ---
    coherence_score = 0.5  # default neutral
    if current_cart:
        cart_brands = [p.brand for p in current_cart if p.brand]
        cart_colors = [c for p in current_cart for c in (p.colors or [])]
        if product.brand in cart_brands:
            coherence_score += 0.3
        # Color family matching would use LLM or color clustering
    
    # --- COMPOSITE ---
    total = (
        0.35 * review_score +
        0.25 * price_score +
        0.25 * delivery_score +
        0.10 * pref_score +
        0.05 * coherence_score
    )
    
    return ScoredProduct(
        product=product,
        total_score=round(total * 100, 1),
        breakdown={
            "reviews": round(review_score * 35, 1),
            "price": round(price_score * 25, 1),
            "delivery": round(delivery_score * 25, 1),
            "preference": round(pref_score * 10, 1),
            "coherence": round(coherence_score * 5, 1),
        },
        max_possible={
            "reviews": 35,
            "price": 25,
            "delivery": 25,
            "preference": 10,
            "coherence": 5,
        }
    )
```

### Step 4: Explanation Generation

After scoring, use Claude to generate human-readable explanations:

```python
explanation_prompt = f"""
Product: {product.title} from {product.retailer}
Score: {scored.total_score}/100
Breakdown: {json.dumps(scored.breakdown)}

The user wants: {category.requirements}
Budget per item: ${budget_per_item:.2f}
Delivery deadline: {constraints.delivery_deadline}

Write a 2-sentence explanation of why this product is ranked #{rank} for the {category.category} category. Reference specific score factors. Be concise.
"""
```

---

## Frontend Components (Next.js 16 + shadcn/ui + Lucide)

### Page Structure

```
app/
├── layout.tsx              # Root layout with font + theme
├── page.tsx                # Main page — chat + cart split view
├── components/
│   ├── chat/
│   │   ├── ChatUI.tsx          # Main chat interface
│   │   ├── ChatMessage.tsx     # Individual message bubble
│   │   ├── ShoppingSpecCard.tsx # Rendered JSON spec for confirmation
│   │   └── ProgressIndicator.tsx # "Searching REI..." animation
│   ├── cart/
│   │   ├── CartView.tsx         # Combined multi-retailer cart
│   │   ├── CartItem.tsx         # Single item with retailer badge
│   │   ├── CartSummary.tsx      # Totals, budget bar, per-retailer subtotals
│   │   └── SwapDrawer.tsx       # Drawer showing alternatives with scores
│   ├── ranking/
│   │   ├── ScoreBreakdown.tsx   # Radar chart or stacked bar of score factors
│   │   ├── ScoreBar.tsx         # Individual score factor bar
│   │   └── ExplanationCard.tsx  # "Why is this #1?" LLM explanation
│   ├── checkout/
│   │   ├── CheckoutFlow.tsx     # Multi-step simulated checkout
│   │   ├── AddressForm.tsx      # One-time address input
│   │   ├── PaymentForm.tsx      # One-time payment input
│   │   └── RetailerCheckoutStep.tsx # Per-retailer simulated step
│   └── shared/
│       ├── RetailerBadge.tsx    # Colored badge with retailer logo/name
│       ├── BudgetBar.tsx        # Visual budget remaining indicator
│       └── ProductImage.tsx     # Image with fallback
```

### Key shadcn/ui Components to Use

- `Card`, `CardHeader`, `CardContent` — product cards, cart items
- `Sheet` / `Drawer` — swap alternatives panel
- `Badge` — retailer badges, score labels, priority tags
- `Progress` — budget bar, score bars, checkout progress
- `Dialog` — confirmation dialogs, score detail popup
- `Tabs` — switch between "Cart" / "All Compared" / "Checkout"
- `Input`, `Label`, `Select` — checkout forms
- `Separator` — visual dividers
- `Tooltip` — hover explanations on score factors
- `ScrollArea` — scrollable product lists
- `Skeleton` — loading states while agent searches

### Key Lucide Icons to Use

- `ShoppingCart`, `Package`, `Truck` — cart, products, delivery
- `Star`, `StarHalf` — ratings
- `ArrowUpDown`, `ArrowRightLeft` — swap/compare
- `Search`, `Filter` — search actions
- `CheckCircle`, `XCircle`, `AlertCircle` — status indicators
- `DollarSign`, `Timer`, `Shield` — price, delivery, quality
- `ChevronRight`, `ChevronDown` — navigation
- `MessageSquare`, `Send` — chat UI
- `BarChart3`, `TrendingUp` — score visualization
- `Snowflake`, `Mountain` — skiing theme

---

## Backend API Endpoints (FastAPI)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Agentic Commerce API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- Intent Parsing ---
@app.post("/api/parse-intent")
async def parse_intent(message: UserMessage) -> ShoppingSpec | ClarifyingQuestion:
    """Send user message to Claude, get back structured spec or clarifying question."""

# --- Product Discovery ---
@app.post("/api/discover")
async def discover_products(spec: ShoppingSpec) -> DiscoveryResults:
    """For each item in spec, search SerpAPI + scraping + mocks. Returns categorized products."""

# --- Ranking ---
@app.post("/api/rank")
async def rank_products(request: RankRequest) -> RankedResults:
    """Apply transparent scoring engine. Returns scored + sorted products with breakdown."""

# --- Cart Operations ---
@app.post("/api/cart/build")
async def build_cart(ranked: RankedResults) -> Cart:
    """Auto-select top-ranked item per category. Budget-aware selection."""

@app.post("/api/cart/swap")
async def swap_item(request: SwapRequest) -> Cart:
    """Replace an item in cart, re-optimize remaining budget, re-score coherence."""

# --- Explanation ---
@app.post("/api/explain")
async def explain_ranking(request: ExplainRequest) -> Explanation:
    """Claude-generated explanation for why a product is ranked at its position."""

# --- Checkout (Simulated) ---
@app.post("/api/checkout/plan")
async def checkout_plan(cart: Cart, user_info: UserInfo) -> CheckoutPlan:
    """Generate per-retailer checkout steps with autofill preview."""

@app.post("/api/checkout/execute")
async def execute_checkout(plan: CheckoutPlan) -> CheckoutResult:
    """Simulate checkout execution. Returns per-retailer success/status."""

# --- Optimization (Stretch) ---
@app.post("/api/optimize/budget")
async def optimize_budget(cart: Cart) -> Cart:
    """Same outfit, cheaper. Find lower-priced alternatives maintaining quality."""

@app.post("/api/optimize/delivery")
async def optimize_delivery(cart: Cart) -> Cart:
    """Everything arrives by deadline. Swap items that won't make it."""
```

### Pydantic Models

```python
from pydantic import BaseModel
from datetime import date
from enum import Enum

class Priority(str, Enum):
    MUST_HAVE = "must_have"
    NICE_TO_HAVE = "nice_to_have"

class Category(str, Enum):
    JACKET = "jacket"
    PANTS = "pants"
    BASE_LAYER_TOP = "base_layer_top"
    BASE_LAYER_BOTTOM = "base_layer_bottom"
    GLOVES = "gloves"
    GOGGLES = "goggles"
    HELMET = "helmet"
    SOCKS = "socks"
    NECK_GAITER = "neck_gaiter"

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

class ScoreBreakdown(BaseModel):
    reviews: float       # out of 35
    price: float         # out of 25
    delivery: float      # out of 25
    preference: float    # out of 10
    coherence: float     # out of 5

class ScoredProduct(BaseModel):
    product: Product
    total_score: float   # 0-100
    breakdown: ScoreBreakdown
    rank: int
    explanation: str | None = None

class CartItem(BaseModel):
    category: Category
    selected: ScoredProduct
    alternatives: list[ScoredProduct]  # top 3-5 alternatives

class Cart(BaseModel):
    items: list[CartItem]
    total_price: float
    budget_remaining: float
    retailers_involved: list[str]
    all_within_deadline: bool
```

---

## Project File Structure

```
agentic-commerce/
├── frontend/                          # Next.js 16
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Main split view: chat | cart
│   │   ├── globals.css
│   │   └── fonts/
│   ├── components/                    # See Frontend Components section
│   │   ├── chat/
│   │   ├── cart/
│   │   ├── ranking/
│   │   ├── checkout/
│   │   ├── shared/
│   │   └── ui/                        # shadcn/ui components
│   ├── lib/
│   │   ├── api.ts                     # Fetch wrappers for FastAPI endpoints
│   │   ├── types.ts                   # TypeScript types matching Pydantic models
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useChat.ts                 # Chat state management
│   │   ├── useCart.ts                 # Cart state + optimistic updates
│   │   └── useDiscovery.ts           # Product discovery state + polling
│   ├── components.json                # shadcn/ui config
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── package.json
│
├── backend/                           # FastAPI
│   ├── main.py                        # FastAPI app + CORS + routes
│   ├── models/
│   │   ├── schemas.py                 # Pydantic models (see above)
│   │   └── enums.py
│   ├── services/
│   │   ├── intent_parser.py           # Claude API for spec generation
│   │   ├── discovery.py               # Orchestrates all data sources
│   │   ├── serpapi_client.py          # Google Shopping + Immersive Product
│   │   ├── scraper.py                 # BeautifulSoup Schema.org extraction
│   │   ├── mock_data.py               # Fallback mock retailer data
│   │   ├── ranking.py                 # Transparent scoring engine
│   │   ├── explainer.py               # Claude API for explanations
│   │   └── checkout.py                # Simulated checkout orchestration
│   ├── data/
│   │   └── mock_retailers.json        # Realistic mock product data
│   ├── config.py                      # API keys, settings
│   ├── requirements.txt
│   └── pyproject.toml
│
├── claude.md                          # This file
└── README.md
```

---

## Critical Implementation Rules

1. **3+ retailers visible in cart** — Cart must show items from at least 3 distinct retailers with clear retailer badges/branding.

2. **Ranking is algorithmic, not LLM** — Use the weighted scoring formula. LLM only generates human-readable explanations AFTER scoring. Weights: Reviews 35%, Price 25%, Delivery 25%, Preference 10%, Coherence 5%.

3. **Google Product API is dead** — Always use `google_immersive_product` engine with `page_token` from shopping results. Set `more_stores=true` for more retailer options.

4. **Cart modification triggers re-ranking** — When user swaps an item, recalculate set coherence scores and budget allocation for remaining items.

5. **Mock data fallback everywhere** — Every SerpAPI call should have a try/except that falls back to mock data. Demo reliability > live data.

6. **Single checkout info entry** — User enters address + payment ONCE. Agent fans out simulated checkout per retailer.

7. **Score transparency is the differentiator** — Every product shows its score breakdown. User can see "why #1?" for any item. This is what makes it NOT a chatbot.

8. **Speed target** — Intent to populated cart in < 30 seconds. Use async/parallel requests for all SerpAPI calls.

---

## Hackathon Demo Script

1. **User opens app** → sees chat interface with skiing theme
2. **User types:** "I need a full skiing outfit for downhill, warm and waterproof, I'm a medium, budget is $400, needs to arrive by Friday"
3. **Agent responds:** shows parsed spec card, confirms items (jacket, pants, base layer, gloves, goggles + nice-to-haves)
4. **Agent searches:** animated progress showing "Searching REI... Backcountry... evo... Amazon..."
5. **Cart populates:** combined cart with best-scored items from different retailers
6. **User clicks "Why #1?"** on the jacket → sees score breakdown radar chart + explanation
7. **User swaps gloves:** opens alternatives drawer, picks cheaper option → cart re-optimizes
8. **User clicks checkout:** enters info once → sees per-retailer checkout plan → simulated execution
9. **Bonus:** user clicks "Make it cheaper" → budget optimizer swaps items, saves $60

---

## Environment Variables

```env
# Backend (.env)
SERPAPI_KEY=your_serpapi_key
ANTHROPIC_API_KEY=your_claude_key
MOCK_MODE=false  # Set true to skip all API calls and use only mocks

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
```