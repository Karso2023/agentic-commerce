"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, CheckCircle, Loader2 } from "lucide-react";
import { CATEGORY_LABELS, type Category } from "@/lib/types";
import type { DiscoveryProgress } from "@/hooks/useDiscovery";

interface ProgressIndicatorProps {
  progress: DiscoveryProgress[];
  isRanking?: boolean;
}

export function ProgressIndicator({
  progress,
  isRanking,
}: ProgressIndicatorProps) {
  const completed = progress.filter((p) => p.status === "done").length;
  const total = progress.length;
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-500" />
          {isRanking ? "Ranking products..." : "Searching retailers..."}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={isRanking ? 100 : percentage} className="h-2" />
        <div className="space-y-2">
          {progress.map((item) => (
            <div
              key={item.category}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">
                {CATEGORY_LABELS[item.category as Category] || item.category}
              </span>
              {item.status === "done" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : item.status === "searching" ? (
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <Skeleton className="h-4 w-4 rounded-full" />
              )}
            </div>
          ))}
        </div>
        {isRanking && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Scoring and ranking products...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
