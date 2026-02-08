"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/lib/types";

export interface LikedProductRow {
  id: string;
  product_id: string;
  product_snapshot: ProductSnapshot;
  created_at: string;
}

export interface ProductSnapshot {
  id: string;
  name: string;
  retailer: string;
  price: number;
  image_url?: string | null;
  product_url?: string | null;
}

const supabase = createClient();

function productToSnapshot(p: Product): ProductSnapshot {
  return {
    id: p.id,
    name: p.name,
    retailer: p.retailer,
    price: p.price,
    image_url: p.image_url,
    product_url: p.product_url,
  };
}

export function useLikedProducts(userId: string | undefined) {
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<LikedProductRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLiked = useCallback(async () => {
    if (!userId) {
      setLikedIds(new Set());
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("liked_products")
      .select("id, product_id, product_snapshot, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error("Failed to fetch liked products:", error);
      return;
    }
    const rows = (data ?? []) as LikedProductRow[];
    setItems(rows);
    setLikedIds(new Set(rows.map((r) => r.product_id)));
  }, [userId]);

  useEffect(() => {
    fetchLiked();
  }, [fetchLiked]);

  const add = useCallback(
    async (product: Product) => {
      if (!userId) return { error: new Error("Not signed in") };
      const snapshot = productToSnapshot(product);
      const { error } = await supabase.from("liked_products").insert({
        user_id: userId,
        product_id: product.id,
        product_snapshot: snapshot,
      });
      if (error) return { error };
      await fetchLiked();
      return { error: null };
    },
    [userId, fetchLiked]
  );

  const remove = useCallback(
    async (productId: string) => {
      if (!userId) return { error: new Error("Not signed in") };
      const { error } = await supabase
        .from("liked_products")
        .delete()
        .eq("user_id", userId)
        .eq("product_id", productId);
      if (error) return { error };
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      setItems((prev) => prev.filter((r) => r.product_id !== productId));
      return { error: null };
    },
    [userId]
  );

  const toggle = useCallback(
    async (product: Product) => {
      if (!userId) return { error: new Error("Not signed in") };
      if (likedIds.has(product.id)) return remove(product.id);
      return add(product);
    },
    [userId, likedIds, add, remove]
  );

  const isLiked = useCallback(
    (productId: string) => likedIds.has(productId),
    [likedIds]
  );

  return { items, likedIds, loading, add, remove, toggle, isLiked, refetch: fetchLiked };
}
