"use client";

import { Progress } from "@/components/ui/progress";
import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface BudgetBarProps {
  spent: number;
  budget: number;
}

export function BudgetBar({ spent, budget }: BudgetBarProps) {
  const percentage = Math.min((spent / budget) * 100, 100);
  const remaining = budget - spent;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5" />
          <span>Budget</span>
        </div>
        <span
          className={cn(
            "font-medium",
            remaining < 0
              ? "text-red-500"
              : remaining < budget * 0.2
                ? "text-yellow-500"
                : "text-green-500"
          )}
        >
          ${remaining.toFixed(2)} remaining
        </span>
      </div>
      <Progress
        value={percentage}
        className={cn(
          "h-2",
          percentage > 100
            ? "[&>[data-state=complete]]:bg-red-500 [&>div]:bg-red-500"
            : percentage > 80
              ? "[&>div]:bg-yellow-500"
              : "[&>div]:bg-green-500"
        )}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>${spent.toFixed(2)} spent</span>
        <span>${budget.toFixed(2)} total</span>
      </div>
    </div>
  );
}
