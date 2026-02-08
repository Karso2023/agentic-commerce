"use client";

import { useCallback, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ShoppingCart, Mountain } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatUI } from "@/components/chat/ChatUI";
import { CartView } from "@/components/cart/CartView";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { useChat } from "@/hooks/useChat";
import { useCart } from "@/hooks/useCart";
import { useDiscovery } from "@/hooks/useDiscovery";
import type { AppState, Category } from "@/lib/types";

export default function Home() {
  const chat = useChat();
  const cart = useCart();
  const discovery = useDiscovery();
  const [showCheckout, setShowCheckout] = useState(false);

  // Orchestrate the full pipeline when spec is confirmed
  const handleConfirmSpec = useCallback(async () => {
    if (!chat.spec) return;

    chat.confirmSpec();

    // Run discovery + ranking pipeline
    const ranked = await discovery.runPipeline(chat.spec);

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
  }, [chat, cart, discovery]);

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
              onSendMessage={chat.sendMessage}
              onConfirmSpec={handleConfirmSpec}
              onReset={chat.resetChat}
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
            onSendMessage={chat.sendMessage}
            onConfirmSpec={handleConfirmSpec}
            onReset={chat.resetChat}
          />
        </div>

        {/* Right: Cart/Checkout (45%) */}
        <div className="w-[45%] min-h-0 flex flex-col overflow-hidden">{rightPanel()}</div>
      </div>
    </div>
  );
}
