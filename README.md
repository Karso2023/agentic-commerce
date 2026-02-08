# Agentic Commerce

An AI-powered shopping agent that turns natural-language requests into a ranked, multi-retailer cart with transparent scoring, direct product links, and optional account features (likes, chat history, recommender).

---

## Features

- **Conversational search** — Describe what you want (e.g. "gaming headset and keyboard, budget $200" or "hackathon for 60 people: snacks, badges, adapters"); the agent infers categories, budget, and delivery with minimal follow-up.
- **Multi-retailer discovery and ranking** — Products are discovered across retailers, scored, and combined into a single cart. Each product shows a score breakdown (reviews, price, delivery, preference, coherence, and for logged-in users a user-preference component).
- **Transparent scoring** — Every score factor has a short explanation (tooltip). Users see why a product is ranked as it is.
- **Direct product links** — Cart items and the chat show "View on [retailer]" links to the live product page. Links are only shown after validation so users are not sent to dead or "product no longer available" pages.
- **Auth (Supabase)** — Email and Google sign-in. Responsive login and register pages.
- **Liked products** — Logged-in users can like items (heart icon). Likes are stored per user. From the Liked page, users can add an item to the cart (price is re-fetched) and see the exact URL each product was fetched from.
- **Chat history** — Logged-in users have chat sessions saved and can load past conversations from a History view. Chat and cart are isolated per user (logout or account switch clears and resets).
- **Recommender system** — For logged-in users, the ranking step uses their liked products to add a small "user preference" score (same retailer or similar price range), so results better match their taste.
- **Product-no-longer-available handling** — URLs are validated before being shown or used. The system detects "product no longer exists" and similar error pages using text patterns, optional screenshot plus vision model, and optional text LLM, so users rarely hit broken links.
- **Cart persistence** — Cart and current chat survive navigation (e.g. to Liked and back) via in-memory state and optional localStorage; no Supabase needed for the cart itself.

---

## Problems and Solutions

| Problem | Solution |
|--------|----------|
| Fragmented search across many retailers | Single conversational search; discovery and ranking run across retailers and results are merged into one cart. |
| Unclear why one product ranks above another | Transparent score breakdown (reviews, price, delivery, preference, coherence, user preference) with tooltips that explain each factor. |
| Dead or "product no longer available" links | URL validator: fetch page, check text patterns and optional screenshot + vision (and text LLM) so only valid product pages are linked or used in comparisons. |
| No personalization | Recommender uses liked products (retailer and price similarity) to add a user-preference component to the ranking score. |
| Losing cart or chat when switching pages or accounts | Cart and chat live in app state (and localStorage for guests); they are cleared and reset on logout or account switch so each user only sees their own data. |

---

## Recommender System

The recommender is **content-based** and uses only the current user’s **liked products** (no cross-user data).

- **Input** — When a logged-in user confirms a search, the frontend sends liked product snapshots (id, name, retailer, price) to the backend with the rank request.
- **Scoring** — For each candidate product we compute a **user preference** score (0–5):
  - **Retailer match** (about 60%): 1 if the product’s retailer appears in the user’s liked retailers, else 0.
  - **Price similarity** (about 40%): closeness of the product’s price to the average price of liked items (e.g. `1 - |price - avg| / avg`, clamped).
- This value is added as an extra factor in the overall score (e.g. up to 5 points). Products from preferred retailers and in a similar price range rank higher; if the user is not logged in or has no likes, this term is zero.

No matrix factorization or cross-user signals are used; the design is simple, privacy-friendly, and works with a single user’s likes.

---

## Product-Not-Found (Dead Link) Solution

We avoid showing or using product URLs that lead to "product no longer available" or error pages.

**Flow**

1. **URL and HTTP** — Only non-empty `http`/`https` URLs are considered. The validator fetches the page (first chunk of HTML, timeout and size limits).
2. **Text patterns** — The response body is checked against a list of regex patterns (e.g. "product no longer available", "page not found", "we couldn't find this page", "currently unavailable"). If any match, the URL is treated as invalid.
3. **Product signals** — If the text contains strong product-page signals (e.g. "add to cart", "buy now", price-like text), the URL can be treated as valid even without further checks.
4. **Screenshot + vision (when enabled)** — For image-based error pages (e.g. Amazon’s "sorry we couldn’t find this page" as an image), we optionally:
   - Take a **screenshot** of the page (Playwright, above-the-fold).
   - Send the **image** to a **vision-capable model** (e.g. OpenAI) with a prompt that asks: does this screenshot show a "product no longer available" or error page? YES/NO.
   - If the model answers YES, the URL is invalid; if NO, we treat it as valid (subject to other checks).
5. **Text LLM fallback** — If no screenshot/vision is used or it’s inconclusive, we can send a **text snippet** of the page to an LLM with the same kind of YES/NO question and use that to mark the URL invalid or valid.
6. **Caching and backoff** — Results are cached per URL (e.g. valid 6h, invalid 1h). Domains that repeatedly fail get a short backoff to avoid hammering broken or blocking hosts.

So: **text-only** detection uses regex (and optional text LLM). **Image-based** error pages are handled by **screenshot + vision model** when an API key is configured and the screenshot step succeeds.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind, shadcn-style UI |
| Auth and user data | Supabase (auth, liked products, chat history; RLS for per-user isolation) |
| Backend | FastAPI (Python): intent parsing, discovery, ranking, cart, checkout simulation, URL validation |
| Product data | SerpAPI (e.g. Google Shopping), BeautifulSoup (Schema.org), optional mock data |
| URL validation | Requests (fetch), regex, optional Playwright (screenshot), optional OpenAI vision and text LLM |

---

## Project Structure

- `frontend/` — Next.js app (chat, cart, auth, liked, history).
- `backend/` — FastAPI app (routes, intent, discovery, ranking, cart, checkout, URL validator).
- `supabase/schema.sql` — SQL for Supabase (e.g. liked_products, chat_history, RLS).

See `DEPLOYMENT.md` for hosting frontend and backend separately (e.g. Vercel + EC2) and setting `NEXT_PUBLIC_API_URL` and CORS.

---

## Security (what’s in place and what’s not)

**In place**

- **Input hardening** — User messages are sanitized (max length, blocklisted prompt-injection phrases) before being sent to the LLM. System prompts are wrapped with “untrusted input” instructions and JSON-only output.
- **Rate limiting** — API is rate-limited (default 30 requests/minute per IP) to reduce abuse.
- **CORS** — Allowed origins are configured via `CORS_ORIGINS` (no wildcard by default).
- **Security headers** — Responses send `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`.
- **URL validation** — Product URLs must be `http`/`https` only (no `javascript:` etc.). Add-to-cart and product-detail flows validate that the page still exists before use.
- **Secrets** — API keys (OpenAI, SerpAPI) live in `.env`; `.env` is gitignored. Use `.env.example` as a template; never commit real keys.

**Gaps / production notes**

- **Backend has no authentication** — All `/api/*` endpoints are public. Anyone who can reach the API can call parse-intent, discover, rank, transcribe, etc. User identity exists only in the frontend (Supabase) for chat history and liked products; the FastAPI server does not verify tokens.
- **Session is not user-bound** — Cart/rank state is stored in memory keyed by `session_id` (default `"default"`). The frontend does not send a user or session token, so backend session isolation is not per-user. Clearing the cart on sign-out is done in the frontend only.
- **Production** — For a public deployment, restrict `CORS_ORIGINS` to your frontend origin(s). If the API is exposed to the internet, consider adding authentication (e.g. validate Supabase JWT on sensitive routes) and binding sessions to the authenticated user.
