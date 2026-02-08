"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { ScoreBar } from "./ScoreBar";
import type { ScoreBreakdown as ScoreBreakdownType } from "@/lib/types";

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdownType;
  totalScore: number;
  compact?: boolean;
}

const MAX_POSSIBLE: Record<string, number> = {
  reviews: 35,
  price: 25,
  delivery: 25,
  preference: 10,
  coherence: 5,
  user_preference: 5,
};

export function ScoreBreakdown({
  breakdown,
  totalScore,
  compact = false,
}: ScoreBreakdownProps) {
  const factors = [
    { label: "Reviews", score: breakdown.reviews, max: MAX_POSSIBLE.reviews },
    { label: "Price", score: breakdown.price, max: MAX_POSSIBLE.price },
    { label: "Delivery", score: breakdown.delivery, max: MAX_POSSIBLE.delivery },
    { label: "Preference", score: breakdown.preference, max: MAX_POSSIBLE.preference },
    { label: "Coherence", score: breakdown.coherence, max: MAX_POSSIBLE.coherence },
    ...(breakdown.user_preference != null
      ? [{ label: "User preference", score: breakdown.user_preference, max: MAX_POSSIBLE.user_preference }]
      : []),
  ];

  if (compact) {
    return (
      <div className="space-y-1.5">
        {factors.map((f) => (
          <ScoreBar
            key={f.label}
            label={f.label}
            score={f.score}
            maxScore={f.max}
          />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Score Breakdown
          </span>
          <span className="text-lg font-bold">{totalScore}/100</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {factors.map((f) => (
          <ScoreBar
            key={f.label}
            label={f.label}
            score={f.score}
            maxScore={f.max}
          />
        ))}
      </CardContent>
    </Card>
  );
}
