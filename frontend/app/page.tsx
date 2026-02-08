"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ShoppingCart, Mountain } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppHeader } from "@/components/AppHeader";
import { ChatUI } from "@/components/chat/ChatUI";
import { CartView } from "@/components/cart/CartView";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useChat } from "@/hooks/useChat";
import { useCartContext } from "@/contexts/CartContext";
import { useDiscovery } from "@/hooks/useDiscovery";
import { useLikedProducts } from "@/hooks/useLikedProducts";
import { useChatHistory, CHAT_SESSION_STORAGE_KEY } from "@/hooks/useChatHistory";
import { useAuth } from "@/contexts/AuthContext";
import type { AppState, Category, ChatMessage, Product } from "@/lib/types";

export default function Home() {
  const chat = useChat();
  const cart = useCartContext();
  const discovery = useDiscovery();
  const pathname = usePathname();
  const { user } = useAuth();
  const liked = useLikedProducts(user?.id);
  const chatHistory = useChatHistory(user?.id);
  const [showCheckout, setShowCheckout] = useState(false);
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  // When user changes (logout or switch account), reset chat so history is private per user
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (previousUserIdRef.current !== undefined && previousUserIdRef.current !== currentUserId) {
      chat.resetChat();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("agentic-commerce-current-chat");
      }
    }
    previousUserIdRef.current = currentUserId;
  }, [user?.id, chat.resetChat]);

  // On mount: restore from History (sessionStorage) or from localStorage only for guests
  useEffect(() => {
    const fromHistory = sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (fromHistory) {
      try {
        const { messages } = JSON.parse(fromHistory) as { messages: unknown[] };
        sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
        if (Array.isArray(messages) && messages.length) chat.loadSession(messages as ChatMessage[]);
      } catch {
        sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
      }
      return;
    }
    if (user) return;
    const chatRaw = typeof window !== "undefined" ? localStorage.getItem("agentic-commerce-current-chat") : null;
    if (chatRaw) {
      try {
        const parsed = JSON.parse(chatRaw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length) chat.loadSession(parsed);
      } catch {
        localStorage.removeItem("agentic-commerce-current-chat");
      }
    }
  }, [chat.loadSession, user]);

  // Auto-save chat for logged-in users (debounced) to Supabase
  useEffect(() => {
    if (!user) return;
    chatHistory.debouncedSave(chat.messages);
  }, [user, chat.messages, chatHistory.debouncedSave]);

  // Persist current chat to localStorage so it survives navigation (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      if (chat.messages.length === 0) return;
      const toStore = chat.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      }));
      localStorage.setItem("agentic-commerce-current-chat", JSON.stringify(toStore));
    }, 500);
    return () => clearTimeout(t);
  }, [chat.messages]);

  const handleResetChat = useCallback(() => {
    chat.resetChat();
    chatHistory.clearCurrentSessionId();
  }, [chat, chatHistory]);

  const handleLikeClick = useCallback(
    (product: Product) => {
      if (user) {
        liked.toggle(product);
      } else {
        window.location.href = `/register?redirect=${encodeURIComponent(pathname ?? "/")}`;
      }
    },
    [user, pathname, liked]
  );

  // Orchestrate the full pipeline when spec is confirmed (pass liked items for recommender)
  const handleConfirmSpec = useCallback(async () => {
    if (!chat.spec) return;

    chat.confirmSpec();

    const likedSnapshots = user
      ? liked.items.map((row) => ({
          id: row.product_snapshot.id,
          name: row.product_snapshot.name,
          retailer: row.product_snapshot.retailer,
          price: row.product_snapshot.price,
        }))
      : undefined;

    // Run discovery + ranking pipeline
    const ranked = await discovery.runPipeline(chat.spec, likedSnapshots);

    if (ranked) {
      chat.updateFlowState("ranking" as AppState);
      await cart.initializeCart(ranked);
      chat.updateFlowState("cart_ready" as AppState);
      chat.addMessage(
        "assistant",
        `Found and ranked products across ${new Set(
          Object.values(ranked.ranked_by_category)
            .flat()
            .map((p) => p.product.retailer)
        ).size}+ retailers! Your optimized cart is ready. Check it out on the right.`
      );
    } else {
      chat.updateFlowState("idle" as AppState);
      chat.addMessage(
        "assistant",
        "Sorry, I had trouble finding products. Please try again."
      );
    }
  }, [chat, cart, discovery, user, liked.items]);

  const handleSwap = useCallback(
    async (category: Category, productId: string) => {
      await cart.swapItem(category, productId);
    },
    [cart]
  );

  const handleCheckout = () => setShowCheckout(true);
  const handleBackFromCheckout = () => setShowCheckout(false);

  const rightPanel = () => {
    if (showCheckout && cart.cart) {
      return (
        <CheckoutFlow cart={cart.cart} onBack={handleBackFromCheckout} />
      );
    }

    if (cart.cart) {
      return (
        <CartView
          cart={cart.cart}
          onSwap={handleSwap}
          onCheckout={handleCheckout}
          onOptimizeBudget={cart.optimizeForBudget}
          onOptimizeDelivery={cart.optimizeForDelivery}
          isOptimizing={cart.isLoading}
          isLiked={liked.isLiked}
          onLikeClick={handleLikeClick}
        />
      );
    }

    // Empty state
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Mountain className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground">
          Your Cart
        </h3>
        <p className="text-sm text-muted-foreground/60 mt-2 max-w-xs">
          Tell the agent what you want to buy and products will appear here
          after discovery.
        </p>
        {(chat.flowState === "discovering" || chat.flowState === "ranking") && (
          <div className="mt-6 w-full max-w-xs space-y-3">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen h-dvh flex flex-col overflow-hidden">
      <AppHeader />
      {/* Mobile: Tabbed layout — responsive with touch-friendly targets */}
      <div className="md:hidden flex-1 min-h-0 flex flex-col">
        <Tabs defaultValue="chat" className="h-full flex flex-col min-h-0">
          <TabsList className="w-full rounded-none border-b shrink-0 h-12 px-2 gap-1">
            <TabsTrigger value="chat" className="flex-1 gap-1.5 py-2.5 min-h-[44px]">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="cart" className="flex-1 gap-1.5 py-2.5 min-h-[44px]">
              <ShoppingCart className="h-4 w-4" />
              Cart
              {cart.cart && (
                <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 min-w-[1.25rem]">
                  {cart.cart.items.length}
                </span>
              )}
            </TabsTrigger>
            <ThemeToggle />
          </TabsList>
          <TabsContent value="chat" className="flex-1 m-0 min-h-0 overflow-hidden">
            <ChatUI
              messages={chat.messages}
              isLoading={chat.isLoading}
              flowState={chat.flowState}
              progress={discovery.progress}
              isRanking={discovery.isRanking}
              cart={cart.cart}
              onSendMessage={chat.sendMessage}
              onConfirmSpec={handleConfirmSpec}
              onReset={handleResetChat}
            />
          </TabsContent>
          <TabsContent value="cart" className="flex-1 m-0 min-h-0 overflow-hidden">
            {rightPanel()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop: Split view */}
      <div className="hidden md:flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Chat (55%) */}
        <div className="w-[55%] border-r min-h-0 flex flex-col">
          <ChatUI
            messages={chat.messages}
            isLoading={chat.isLoading}
            flowState={chat.flowState}
            progress={discovery.progress}
            isRanking={discovery.isRanking}
            cart={cart.cart}
            onSendMessage={chat.sendMessage}
            onConfirmSpec={handleConfirmSpec}
            onReset={handleResetChat}
          />
        </div>

        {/* Right: Cart/Checkout (45%) */}
        <div className="w-[45%] min-h-0 flex flex-col overflow-hidden">{rightPanel()}</div>
      </div>
    </div>
  );
}
