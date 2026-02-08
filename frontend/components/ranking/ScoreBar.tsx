"use client";

import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Star, DollarSign, Truck, Shield, Layers, Heart, HelpCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  score: number;
  maxScore: number;
  tooltip?: string;
}

const FACTOR_CONFIG: Record<string, { icon: LucideIcon; tooltip: string }> = {
  reviews: {
    icon: Star,
    tooltip: "Score logic (max 35): 70% from rating (out of 5), 30% from review volume. Higher ratings and more reviews score better.",
  },
  price: {
    icon: DollarSign,
    tooltip: "Score logic (max 25): Compares price to your budget per item. Under budget scores higher; sale/discount gets a small bonus.",
  },
  delivery: {
    icon: Truck,
    tooltip: "Score logic (max 25): On-time delivery by your deadline = full points. Slightly late = half; free shipping adds a small bonus.",
  },
  preference: {
    icon: Shield,
    tooltip: "Score logic (max 10): How many of your requirements (e.g. waterproof, bulk, event) appear in the product name/description. More matches = higher score.",
  },
  coherence: {
    icon: Layers,
    tooltip: "Score logic (max 5): Bonus for brand or color consistency with other items in your cart.",
  },
  "user preference": {
    icon: Heart,
    tooltip: "Score logic (max 5): Recommender from your liked products — same retailer or similar price range scores higher.",
  },
};

export function ScoreBar({ label, score, maxScore, tooltip }: ScoreBarProps) {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const config = FACTOR_CONFIG[label.toLowerCase()] || {
    icon: Star,
    tooltip: "",
  };
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="capitalize text-muted-foreground">{label}</span>
                <span className="flex items-center gap-1">
                  <span className="font-medium">
                    {score.toFixed(1)}/{maxScore}
                  </span>
                  <HelpCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                </span>
              </div>
              <Progress
                value={percentage}
                className={cn(
                  "h-1.5",
                  percentage >= 75
                    ? "[&>div]:bg-green-500"
                    : percentage >= 50
                      ? "[&>div]:bg-yellow-500"
                      : "[&>div]:bg-red-500"
                )}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{tooltip || config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
