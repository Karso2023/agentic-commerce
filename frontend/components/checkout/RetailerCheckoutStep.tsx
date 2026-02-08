"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Loader2, Package } from "lucide-react";
import { RetailerBadge } from "@/components/shared/RetailerBadge";
import type { RetailerCheckoutStep as StepType } from "@/lib/types";
import { CATEGORY_LABELS, type Category } from "@/lib/types";

interface RetailerCheckoutStepProps {
  step: StepType;
  isExecuting: boolean;
  autofillPreview?: string;
}

export function RetailerCheckoutStepCard({
  step,
  isExecuting,
  autofillPreview,
}: RetailerCheckoutStepProps) {
  const isConfirmed = step.status === "confirmed";

  return (
    <Card className={isConfirmed ? "border-green-500/30" : ""}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RetailerBadge retailer={step.retailer} />
            <span className="text-sm font-medium">
              ${step.subtotal.toFixed(2)}
              {step.shipping_cost > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  +${step.shipping_cost.toFixed(2)} shipping
                </span>
              )}
            </span>
          </div>
          {isConfirmed ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : isExecuting ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          ) : (
            <Package className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Items in this retailer order */}
        <div className="space-y-1">
          {step.items.map((item) => (
            <div
              key={item.category}
              className="flex justify-between text-sm text-muted-foreground"
            >
              <span>{CATEGORY_LABELS[item.category as Category]}: {item.selected.product.name}</span>
              <span>${item.selected.product.price.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground">
          Est. delivery: {step.estimated_delivery}
        </div>

        {autofillPreview && (
          <p className="text-xs text-muted-foreground italic">
            {autofillPreview}
          </p>
        )}

        {isConfirmed && step.confirmation_number && (
          <Badge variant="secondary" className="text-xs">
            Confirmation: {step.confirmation_number}
          </Badge>
        )}

        {isExecuting && !isConfirmed && (
          <div className="space-y-2">
            <Skeleton className="h-2 w-full" />
            <p className="text-xs text-muted-foreground">Processing order...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
