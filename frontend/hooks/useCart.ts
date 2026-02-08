"use client";

import { useState, useCallback } from "react";
import type { Cart, RankedResults, Category } from "@/lib/types";
import {
  buildCart,
  swapCartItem,
  optimizeBudget as apiBudget,
  optimizeDelivery as apiDelivery,
} from "@/lib/api";

export function useCart() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [rankedResults, setRankedResults] = useState<RankedResults | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  const initializeCart = useCallback(async (ranked: RankedResults) => {
    setIsLoading(true);
    setRankedResults(ranked);
    try {
      const newCart = await buildCart(ranked);
      setCart(newCart);
    } catch (error) {
      console.error("Failed to build cart:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const swapItem = useCallback(
    async (category: Category, newProductId: string) => {
      if (!cart) return;
      setIsLoading(true);
      try {
        const updatedCart = await swapCartItem({
          category,
          new_product_id: newProductId,
        });
        setCart(updatedCart);
      } catch (error) {
        console.error("Failed to swap item:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [cart]
  );

  const optimizeForBudget = useCallback(async () => {
    if (!cart) return;
    setIsLoading(true);
    try {
      const optimized = await apiBudget(cart);
      setCart(optimized);
    } catch (error) {
      console.error("Failed to optimize budget:", error);
    } finally {
      setIsLoading(false);
    }
  }, [cart]);

  const optimizeForDelivery = useCallback(async () => {
    if (!cart) return;
    setIsLoading(true);
    try {
      const optimized = await apiDelivery(cart);
      setCart(optimized);
    } catch (error) {
      console.error("Failed to optimize delivery:", error);
    } finally {
      setIsLoading(false);
    }
  }, [cart]);

  return {
    cart,
    setCart,
    rankedResults,
    isLoading,
    initializeCart,
    swapItem,
    optimizeForBudget,
    optimizeForDelivery,
  };
}
