// --- Enums ---

export type Category =
  | "jacket"
  | "pants"
  | "base_layer_top"
  | "base_layer_bottom"
  | "gloves"
  | "goggles"
  | "helmet"
  | "socks"
  | "neck_gaiter"
  | "headset"
  | "monitor"
  | "keyboard"
  | "laptop"
  | "running_shoes"
  | "sneakers"
  | "t_shirt"
  | "hoodie"
  | "bag"
  | "watch"
  | "desk_chair"
  | "webcam"
  | "phone"
  | "tablet"
  | "speakers"
  | "gpu";

export type Priority = "must_have" | "nice_to_have";

export const CATEGORY_LABELS: Record<Category, string> = {
  jacket: "Jacket",
  pants: "Pants",
  base_layer_top: "Base Layer Top",
  base_layer_bottom: "Base Layer Bottom",
  gloves: "Gloves",
  goggles: "Goggles",
  helmet: "Helmet",
  socks: "Socks",
  neck_gaiter: "Neck Gaiter",
  headset: "Headset",
  monitor: "Monitor",
  keyboard: "Keyboard",
  laptop: "Laptop",
  running_shoes: "Running Shoes",
  sneakers: "Sneakers",
  t_shirt: "T-Shirt",
  hoodie: "Hoodie",
  bag: "Bag",
  watch: "Watch",
  desk_chair: "Desk Chair",
  webcam: "Webcam",
  phone: "Phone",
  tablet: "Tablet",
  speakers: "Speakers",
  gpu: "GPU",
};

// --- Intent Parsing ---

export interface ItemSpec {
  category: Category;
  priority: Priority;
  requirements: string[];
}

export interface Budget {
  total: number;
  currency: string;
}

export interface Constraints {
  budget: Budget;
  size: string;
  delivery_deadline: string;
  style_preferences: string[];
  brand_preferences: string[];
  color_preferences: string[];
}

export interface ShoppingSpec {
  scenario: string;
  items_needed: ItemSpec[];
  constraints: Constraints;
}

export interface ClarifyingQuestion {
  question: string;
  is_clarification: boolean;
}

// --- Products ---

export interface Product {
  id: string;
  name: string;
  retailer: string;
  price: number;
  original_price?: number | null;
  rating?: number | null;
  reviews_count?: number | null;
  delivery_days?: number | null;
  delivery_cost?: number | null;
  delivery_text?: string | null;
  sizes: string[];
  colors: string[];
  brand?: string | null;
  description?: string | null;
  image_url?: string | null;
  product_url?: string | null;
  highlights: string[];
}

// --- Scoring ---

export interface ScoreBreakdown {
  reviews: number;
  price: number;
  delivery: number;
  preference: number;
  coherence: number;
}

export interface ScoredProduct {
  product: Product;
  total_score: number;
  breakdown: ScoreBreakdown;
  max_possible: Record<string, number>;
  rank: number;
  explanation?: string | null;
}

// --- Cart ---

export interface CartItem {
  category: Category;
  selected: ScoredProduct;
  alternatives: ScoredProduct[];
}

export interface Cart {
  items: CartItem[];
  total_price: number;
  budget_remaining: number;
  retailers_involved: string[];
  all_within_deadline: boolean;
}

// --- Discovery & Ranking ---

export interface DiscoveryResults {
  products_by_category: Record<string, Product[]>;
}

export interface RankedResults {
  ranked_by_category: Record<string, ScoredProduct[]>;
  spec: ShoppingSpec;
}

// --- Swap ---

export interface SwapRequest {
  category: Category;
  new_product_id: string;
  session_id?: string;
}

// --- Explanation ---

export interface ExplainRequest {
  product_id: string;
  category: Category;
  session_id?: string;
}

export interface Explanation {
  product_id: string;
  category: Category;
  explanation: string;
  compared_product_name?: string | null;
  compared_product_url?: string | null;
}

// --- Checkout ---

export interface UserInfo {
  full_name: string;
  email: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
  card_last_four?: string;
}

export interface RetailerCheckoutStep {
  retailer: string;
  items: CartItem[];
  subtotal: number;
  shipping_cost: number;
  estimated_delivery: string;
  status: string;
  confirmation_number?: string | null;
}

export interface CheckoutPlan {
  steps: RetailerCheckoutStep[];
  total: number;
  user_info: UserInfo;
  session_id?: string;
}

export interface CheckoutResult {
  success: boolean;
  steps: RetailerCheckoutStep[];
  total_charged: number;
  message: string;
}

// --- UI State ---

export type AppState =
  | "idle"
  | "parsing"
  | "confirming"
  | "discovering"
  | "ranking"
  | "cart_ready"
  | "checkout"
  | "completed";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  spec?: ShoppingSpec;
  timestamp: Date;
}
