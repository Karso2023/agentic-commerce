"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Truck, CheckCircle } from "lucide-react";
import { RetailerBadge } from "@/components/shared/RetailerBadge";
import { ProductImage } from "@/components/shared/ProductImage";
import { ScoreBreakdown } from "@/components/ranking/ScoreBreakdown";
import type { ScoredProduct, Category } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

interface SwapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  currentProduct: ScoredProduct | null;
  alternatives: ScoredProduct[];
  onSelect: (productId: string) => void;
}

export function SwapDrawer({
  isOpen,
  onClose,
  category,
  currentProduct,
  alternatives,
  onSelect,
}: SwapDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-sm">
            Swap {category ? CATEGORY_LABELS[category] : ""}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          <div className="space-y-3 pr-4">
            {/* Current selection */}
            {currentProduct && (
              <Card className="border-blue-500/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium text-blue-500">
                      Current Selection
                    </span>
                  </div>
                  <ProductCard product={currentProduct} isCurrent />
                </CardContent>
              </Card>
            )}

            {/* Alternatives */}
            {alternatives.map((alt) => (
              <Card key={alt.product.id} className="hover:border-foreground/20 transition-colors">
                <CardContent className="p-3">
                  <ProductCard product={alt} />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        onSelect(alt.product.id);
                        onClose();
                      }}
                    >
                      Select This
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {alternatives.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No alternatives available for this category.
              </p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ProductCard({
  product,
  isCurrent = false,
}: {
  product: ScoredProduct;
  isCurrent?: boolean;
}) {
  const p = product.product;

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <ProductImage src={p.image_url} alt={p.name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight truncate">{p.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <RetailerBadge retailer={p.retailer} />
            <span className="text-sm font-semibold">${p.price.toFixed(2)}</span>
            {p.original_price && p.original_price > p.price && (
              <span className="text-xs text-muted-foreground line-through">
                ${p.original_price.toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Truck className="h-3 w-3" />
              {p.delivery_text ?? (p.delivery_days != null ? `Est. ${p.delivery_days} day${p.delivery_days === 1 ? "" : "s"}` : "—")}
            </span>
            {p.rating != null && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                {p.rating}{p.reviews_count != null ? ` (${p.reviews_count})` : ""}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Variants: {(p.sizes?.length ?? 0) > 0 || (p.colors?.length ?? 0) > 0
                ? [p.sizes?.length ? `Sizes: ${p.sizes.join(", ")}` : null, p.colors?.length ? `Colors: ${p.colors.join(", ")}` : null].filter(Boolean).join(" · ")
                : "—"}
            </span>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 h-6 text-xs">
          {product.total_score}
        </Badge>
      </div>
      <ScoreBreakdown
        breakdown={product.breakdown}
        totalScore={product.total_score}
        compact
      />
    </div>
  );
}
