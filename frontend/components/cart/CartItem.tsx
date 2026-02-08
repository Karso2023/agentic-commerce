"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Star, Truck, ArrowRightLeft, BarChart3 } from "lucide-react";
import { RetailerBadge } from "@/components/shared/RetailerBadge";
import { ProductImage } from "@/components/shared/ProductImage";
import { ScoreBreakdown } from "@/components/ranking/ScoreBreakdown";
import { ExplanationCard } from "@/components/ranking/ExplanationCard";
import { ProductDetailDialog } from "./ProductDetailDialog";
import type { CartItem as CartItemType, Category } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { explainRanking } from "@/lib/api";

interface CartItemProps {
  item: CartItemType;
  onSwap: (category: Category) => void;
}

export function CartItemCard({ item, onSwap }: CartItemProps) {
  const [explanation, setExplanation] = useState<string | null>(
    item.selected.explanation || null
  );
  const [comparedProduct, setComparedProduct] = useState<{
    compared_product_name?: string | null;
    compared_product_url?: string | null;
  } | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const p = item.selected.product;

  const handleExplain = async () => {
    setIsExplaining(true);
    try {
      const result = await explainRanking({
        product_id: p.id,
        category: item.category,
      });
      setExplanation(result.explanation);
      setComparedProduct({
        compared_product_name: result.compared_product_name ?? null,
        compared_product_url: result.compared_product_url ?? null,
      });
    } catch {
      setExplanation("Unable to generate explanation at this time.");
      setComparedProduct(null);
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="text-left flex gap-3 flex-1 min-w-0 rounded-md hover:bg-muted/50 transition-colors -m-1 p-1"
              aria-label={`View details for ${p.name}`}
            >
              <ProductImage src={p.image_url} alt={p.name} size="md" className="shrink-0" />

              <div className="flex-1 min-w-0 space-y-2">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Badge variant="outline" className="text-xs mb-1">
                      {CATEGORY_LABELS[item.category]}
                    </Badge>
                    <p className="text-sm font-medium leading-tight truncate">
                      {p.name}
                    </p>
                  </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <BarChart3 className="h-3 w-3 mr-1" />
                    Rank #1
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-sm">{p.name}</DialogTitle>
                  </DialogHeader>
                  <ScoreBreakdown
                    breakdown={item.selected.breakdown}
                    totalScore={item.selected.total_score}
                  />
                  <ExplanationCard
                    explanation={explanation}
                    isLoading={isExplaining}
                    onRequestExplanation={handleExplain}
                    comparedProductName={comparedProduct?.compared_product_name ?? undefined}
                    comparedProductUrl={comparedProduct?.compared_product_url ?? undefined}
                  />
                </DialogContent>
              </Dialog>
                </div>

                {/* Required: price, delivery estimate, variants, retailer */}
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground">${p.price.toFixed(2)}</span>
                {p.original_price && p.original_price > p.price && (
                  <span className="text-xs text-muted-foreground line-through">
                    ${p.original_price.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  {p.delivery_text ?? (p.delivery_days != null ? `Est. ${p.delivery_days} day${p.delivery_days === 1 ? "" : "s"}` : "—")}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <RetailerBadge retailer={p.retailer} />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Variants:</span>
                {(p.sizes?.length ?? 0) > 0 || (p.colors?.length ?? 0) > 0 ? (
                  <>
                    {p.sizes?.length ? (
                      <span>Sizes: {p.sizes.join(", ")}</span>
                    ) : null}
                    {p.sizes?.length && p.colors?.length ? " · " : null}
                    {p.colors?.length ? (
                      <span>Colors: {p.colors.join(", ")}</span>
                    ) : null}
                  </>
                ) : (
                  <span>—</span>
                )}
              </div>
              {p.rating && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  {p.rating}
                  {p.reviews_count != null && (
                    <span> ({p.reviews_count})</span>
                  )}
                </span>
              )}
            </div>

                {/* Actions */}
                {item.alternatives.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwap(item.category);
                    }}
                  >
                    <ArrowRightLeft className="h-3 w-3 mr-1" />
                    Swap ({item.alternatives.length} alternatives)
                  </Button>
                )}
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      <ProductDetailDialog
        product={p}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
