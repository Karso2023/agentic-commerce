"use client";

import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Star, DollarSign, Truck, Shield, Layers, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  score: number;
  maxScore: number;
  tooltip?: string;
}

const FACTOR_CONFIG: Record<string, { icon: LucideIcon; tooltip: string }> = {
  reviews: { icon: Star, tooltip: "Based on rating quality and review volume" },
  price: { icon: DollarSign, tooltip: "How well the price fits your budget" },
  delivery: { icon: Truck, tooltip: "Whether it arrives by your deadline" },
  preference: { icon: Shield, tooltip: "Matches your requirements (waterproof, warm, etc.)" },
  coherence: { icon: Layers, tooltip: "Brand/color consistency across your outfit" },
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
              <div className="flex justify-between text-xs">
                <span className="capitalize text-muted-foreground">{label}</span>
                <span className="font-medium">
                  {score.toFixed(1)}/{maxScore}
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
        <TooltipContent>
          <p className="text-xs">{tooltip || config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
