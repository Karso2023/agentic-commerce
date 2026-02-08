"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Package } from "lucide-react";
import { CartItemCard } from "./CartItem";
import { CartSummary } from "./CartSummary";
import { SwapDrawer } from "./SwapDrawer";
import type { Cart, Category, ScoredProduct } from "@/lib/types";

interface CartViewProps {
  cart: Cart;
  onSwap: (category: Category, productId: string) => void;
  onCheckout: () => void;
  onOptimizeBudget: () => void;
  onOptimizeDelivery: () => void;
  isOptimizing: boolean;
}

export function CartView({
  cart,
  onSwap,
  onCheckout,
  onOptimizeBudget,
  onOptimizeDelivery,
  isOptimizing,
}: CartViewProps) {
  const [swapCategory, setSwapCategory] = useState<Category | null>(null);
  const [swapCurrent, setSwapCurrent] = useState<ScoredProduct | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<ScoredProduct[]>([]);

  const handleSwapOpen = (category: Category) => {
    const item = cart.items.find((i) => i.category === category);
    if (item) {
      setSwapCategory(category);
      setSwapCurrent(item.selected);
      setSwapAlternatives(item.alternatives);
    }
  };

  const handleSwapSelect = (productId: string) => {
    if (swapCategory) {
      onSwap(swapCategory, productId);
    }
  };

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3 shrink-0">
        <Package className="h-5 w-5 text-green-500" />
        <h2 className="text-sm font-semibold">
          Your Cart ({cart.items.length} items)
        </h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-3">
          {cart.items.map((item) => (
            <CartItemCard
              key={item.category}
              item={item}
              onSwap={handleSwapOpen}
            />
          ))}

          <Separator />

          <CartSummary
            cart={cart}
            onCheckout={onCheckout}
            onOptimizeBudget={onOptimizeBudget}
            onOptimizeDelivery={onOptimizeDelivery}
            isOptimizing={isOptimizing}
          />
        </div>
      </div>

      <SwapDrawer
        isOpen={swapCategory !== null}
        onClose={() => setSwapCategory(null)}
        category={swapCategory}
        currentProduct={swapCurrent}
        alternatives={swapAlternatives}
        onSelect={handleSwapSelect}
      />
    </div>
  );
}
