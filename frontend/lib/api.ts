import type {
  ShoppingSpec,
  ClarifyingQuestion,
  DiscoveryResults,
  RankedResults,
  Cart,
  ScoredProduct,
  SwapRequest,
  ExplainRequest,
  Explanation,
  UserInfo,
  CheckoutPlan,
  CheckoutResult,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

export async function parseIntent(
  message: string
): Promise<ShoppingSpec | ClarifyingQuestion> {
  return fetchAPI("/parse-intent", { message });
}

export async function discoverProducts(
  spec: ShoppingSpec
): Promise<DiscoveryResults> {
  return fetchAPI("/discover", spec);
}

export interface LikedSnapshot {
  id: string;
  name: string;
  retailer: string;
  price: number;
}

export async function rankProducts(
  discoveryResults: DiscoveryResults,
  spec: ShoppingSpec,
  likedSnapshots?: LikedSnapshot[] | null
): Promise<RankedResults> {
  return fetchAPI("/rank", {
    discovery_results: discoveryResults,
    spec,
    liked_snapshots: likedSnapshots ?? undefined,
  });
}

export async function buildCart(rankedResults: RankedResults): Promise<Cart> {
  return fetchAPI("/cart/build", rankedResults);
}

export interface AddItemToCartResponse {
  cart: Cart;
  ranked_by_category: Record<string, ScoredProduct[]>;
  spec: ShoppingSpec;
}

/** Add a product to the cart by URL. Backend re-fetches current price and validates page. */
export async function addItemToCart(productUrl: string): Promise<AddItemToCartResponse> {
  return fetchAPI("/cart/add-item", { product_url: productUrl });
}

export async function swapCartItem(request: SwapRequest): Promise<Cart> {
  return fetchAPI("/cart/swap", request);
}

export async function explainRanking(
  request: ExplainRequest
): Promise<Explanation> {
  return fetchAPI("/explain", request);
}

export async function planCheckout(
  cart: Cart,
  userInfo: UserInfo
): Promise<CheckoutPlan> {
  return fetchAPI("/checkout/plan", { cart, user_info: userInfo });
}

export async function executeCheckout(
  plan: CheckoutPlan
): Promise<CheckoutResult> {
  return fetchAPI("/checkout/execute", plan);
}

export async function optimizeBudget(cart: Cart): Promise<Cart> {
  return fetchAPI("/optimize/budget", cart);
}

export async function optimizeDelivery(
  cart: Cart,
  deadline?: string
): Promise<Cart> {
  return fetchAPI("/optimize/delivery", { cart, deadline });
}

export interface ProductDetailsResponse {
  exists: boolean;
  details: {
    name?: string;
    price?: number;
    currency?: string;
    availability?: string;
    rating?: number;
    review_count?: number;
    brand?: string;
    description?: string;
    image?: string;
  } | null;
  error?: string;
}

export async function fetchProductDetails(
  url: string
): Promise<ProductDetailsResponse> {
  return fetchAPI("/product-details", { url });
}
