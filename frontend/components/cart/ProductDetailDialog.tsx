"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, RefreshCw, Truck, Star, DollarSign } from "lucide-react";
import { ProductImage } from "@/components/shared/ProductImage";
import { RetailerBadge } from "@/components/shared/RetailerBadge";
import { fetchProductDetails } from "@/lib/api";
import type { Product } from "@/lib/types";
import { isValidProductUrl } from "@/lib/utils";

interface ProductDetailDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailDialog({
  product,
  open,
  onOpenChange,
}: ProductDetailDialogProps) {
  const [liveDetails, setLiveDetails] = useState<{
    name?: string;
    price?: number;
    currency?: string;
    description?: string;
    rating?: number;
    review_count?: number;
    brand?: string;
    availability?: string;
    image?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadFromRetailer = useCallback(async () => {
    const url = product.product_url?.trim();
    if (!url || !isValidProductUrl(url)) {
      setFetchError("No valid product link");
      return;
    }
    setLoading(true);
    setFetchError(null);
    setLiveDetails(null);
    try {
      const res = await fetchProductDetails(url);
      if (res.exists && res.details) {
        setLiveDetails(res.details);
      } else {
        setFetchError(res.error || "Page not found or unavailable");
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [product.product_url]);

  const hasValidLink = isValidProductUrl(product.product_url);
  const showOpenLink = hasValidLink && (liveDetails !== undefined || !loading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold pr-8">
            {liveDetails?.name ?? product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            <ProductImage
              src={liveDetails?.image ?? product.image_url}
              alt={product.name}
              size="lg"
            />
            <div className="flex-1 min-w-0 space-y-2">
              <RetailerBadge retailer={product.retailer} />
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">
                  ${(liveDetails?.price ?? product.price).toFixed(2)}
                  {liveDetails?.currency && liveDetails.currency !== "USD" && (
                    <span className="text-xs text-muted-foreground ml-1">
                      {liveDetails.currency}
                    </span>
                  )}
                </span>
              </div>
              {product.delivery_text && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="h-3.5 w-3" />
                  {product.delivery_text}
                </div>
              )}
              {(product.rating != null || liveDetails?.rating != null) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-3.5 w-3 fill-yellow-500 text-yellow-500" />
                  {liveDetails?.rating ?? product.rating}
                  {(liveDetails?.review_count ?? product.reviews_count) != null && (
                    <span>
                      ({(liveDetails?.review_count ?? product.reviews_count)})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {(liveDetails?.description ?? product.description) && (
            <p className="text-sm text-muted-foreground line-clamp-4">
              {liveDetails?.description ?? product.description}
            </p>
          )}

          {hasValidLink && (
            <div className="flex flex-col gap-2">
              {loading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadFromRetailer}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  {liveDetails ? "Refresh from retailer" : "Fetch details from retailer"}
                </Button>
              )}
              {fetchError && (
                <p className="text-xs text-destructive">{fetchError}</p>
              )}
              {showOpenLink && (
                <a
                  href={product.product_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open on {product.retailer}
                </a>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
