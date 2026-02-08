"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Truck,
} from "lucide-react";
import { BudgetBar } from "@/components/shared/BudgetBar";
import { RetailerBadge } from "@/components/shared/RetailerBadge";
import type { Cart } from "@/lib/types";

interface CartSummaryProps {
  cart: Cart;
  onCheckout: () => void;
  onOptimizeBudget: () => void;
  onOptimizeDelivery: () => void;
  isOptimizing: boolean;
}

export function CartSummary({
  cart,
  onCheckout,
  onOptimizeBudget,
  onOptimizeDelivery,
  isOptimizing,
}: CartSummaryProps) {
  const budget = cart.total_price + cart.budget_remaining;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          Cart Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <BudgetBar spent={cart.total_price} budget={budget} />

        <Separator />

        {/* Per-retailer breakdown */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Retailers ({cart.retailers_involved.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cart.retailers_involved.map((r) => (
              <RetailerBadge key={r} retailer={r} />
            ))}
          </div>
        </div>

        {/* Delivery status */}
        <div className="flex items-center gap-2 text-sm">
          {cart.all_within_deadline ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-green-600">All items within delivery deadline</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-yellow-600">Some items may arrive late</span>
            </>
          )}
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Total</span>
          <span className="text-lg font-bold">${cart.total_price.toFixed(2)}</span>
        </div>

        {/* Optimize buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={onOptimizeBudget}
            disabled={isOptimizing}
          >
            <DollarSign className="h-3 w-3 mr-1" />
            Make Cheaper
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={onOptimizeDelivery}
            disabled={isOptimizing}
          >
            <Truck className="h-3 w-3 mr-1" />
            Faster Delivery
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onCheckout} className="w-full">
          Proceed to Checkout
        </Button>
      </CardFooter>
    </Card>
  );
}
