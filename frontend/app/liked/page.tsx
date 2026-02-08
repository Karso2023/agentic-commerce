"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCartContext } from "@/contexts/CartContext";
import { useLikedProducts } from "@/hooks/useLikedProducts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductImage } from "@/components/shared/ProductImage";
import { RetailerBadge } from "@/components/shared/RetailerBadge";
import { ArrowLeft, ExternalLink, Heart, ShoppingCart, Copy, Check } from "lucide-react";
import { isValidProductUrl } from "@/lib/utils";
import { addItemToCart } from "@/lib/api";
import type { RankedResults } from "@/lib/types";

export default function LikedPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const cartContext = useCartContext();
  const { items, loading, remove, refetch } = useLikedProducts(user?.id);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) refetch();
  }, [user, refetch]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground">Sign in to see your liked products.</p>
        <Button asChild>
          <Link href="/register?redirect=/liked">Register</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500 fill-red-500" />
          Liked products
        </h1>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No liked products yet. Add items from your cart with the heart icon.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {items.map((row) => {
              const p = row.product_snapshot;
              return (
                <li key={row.product_id}>
                  <Card>
                    <CardContent className="p-4 flex gap-3">
                      <div className="shrink-0">
                        <ProductImage src={p.image_url} alt={p.name} size="md" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <RetailerBadge retailer={p.retailer} />
                          <span className="text-sm font-semibold">
                            ${p.price.toFixed(2)}
                          </span>
                        </div>
                        {isValidProductUrl(p.product_url) && (
                          <div className="mt-2 space-y-1.5">
                            <p className="text-xs text-muted-foreground">
                              Fetched from:
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={p.product_url!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary underline break-all"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                {p.product_url}
                              </a>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs text-muted-foreground"
                                onClick={() => {
                                  if (p.product_url) {
                                    navigator.clipboard.writeText(p.product_url);
                                    setCopiedUrl(p.product_url);
                                    setTimeout(() => setCopiedUrl(null), 2000);
                                  }
                                }}
                              >
                                {copiedUrl === p.product_url ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {isValidProductUrl(p.product_url) && (
                            <Button
                              size="sm"
                              className="text-xs"
                              disabled={addingId === row.product_id}
                              onClick={async () => {
                                if (!p.product_url) return;
                                setAddError(null);
                                setAddingId(row.product_id);
                                try {
                                  const res = await addItemToCart(p.product_url);
                                  cartContext.setCart(res.cart);
                                  if (res.ranked_by_category && res.spec) {
                                    cartContext.setRankedResults({
                                      ranked_by_category: res.ranked_by_category,
                                      spec: res.spec as RankedResults["spec"],
                                    });
                                  }
                                  router.push("/");
                                } catch (e) {
                                  setAddError(e instanceof Error ? e.message : "Failed to add to cart");
                                } finally {
                                  setAddingId(null);
                                }
                              }}
                            >
                              {addingId === row.product_id ? (
                                "Checking price…"
                              ) : (
                                <>
                                  <ShoppingCart className="h-3 w-3 mr-1" />
                                  Add to cart (re-fetch price)
                                </>
                              )}
                            </Button>
                          )}
                          <a
                            href={p.product_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={!isValidProductUrl(p.product_url) ? "hidden" : "inline-flex items-center gap-1 text-xs text-primary underline"}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View on {p.retailer}
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground"
                            onClick={() => remove(row.product_id)}
                          >
                            Remove from liked
                          </Button>
                        </div>
                        {addError && (
                          <p className="text-xs text-destructive mt-1">{addError}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
