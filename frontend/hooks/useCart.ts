"use client";

import { useState, useCallback, useEffect } from "react";
import type { Cart, RankedResults, Category } from "@/lib/types";
import {
  buildCart,
  swapCartItem,
  optimizeBudget as apiBudget,
  optimizeDelivery as apiDelivery,
} from "@/lib/api";

const CART_STORAGE_KEY = "agentic-commerce-cart";
const RANKED_STORAGE_KEY = "agentic-commerce-ranked";

function readCart(): Cart | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Cart;
  } catch {
    return null;
  }
}

function readRanked(): RankedResults | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RANKED_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RankedResults;
  } catch {
    return null;
  }
}

export function useCart() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [rankedResults, setRankedResults] = useState<RankedResults | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  const restoreFromStorage = useCallback(() => {
    const savedCart = readCart();
    const savedRanked = readRanked();
    if (savedCart) setCart(savedCart);
    if (savedRanked) setRankedResults(savedRanked);
  }, []);

  useEffect(() => {
    if (cart) localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    else localStorage.removeItem(CART_STORAGE_KEY);
  }, [cart]);

  useEffect(() => {
    if (rankedResults) localStorage.setItem(RANKED_STORAGE_KEY, JSON.stringify(rankedResults));
    else localStorage.removeItem(RANKED_STORAGE_KEY);
  }, [rankedResults]);

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
    setRankedResults,
    isLoading,
    initializeCart,
    swapItem,
    optimizeForBudget,
    optimizeForDelivery,
    restoreFromStorage,
  };
}
