"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ExternalLink } from "lucide-react";
import { isValidProductUrl } from "@/lib/utils";

interface ExplanationCardProps {
  explanation: string | null;
  isLoading: boolean;
  onRequestExplanation: () => void;
  comparedProductName?: string | null;
  comparedProductUrl?: string | null;
}

export function ExplanationCard({
  explanation,
  isLoading,
  onRequestExplanation,
  comparedProductName,
  comparedProductUrl,
}: ExplanationCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!explanation) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onRequestExplanation}
        className="text-xs text-muted-foreground"
      >
        <MessageSquare className="h-3.5 w-3.5 mr-1" />
        Why this rank?
      </Button>
    );
  }

  return (
    <Card className="bg-muted/50">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <MessageSquare className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{explanation}</p>
        </div>
        {comparedProductName && isValidProductUrl(comparedProductUrl) && (
          <a
            href={comparedProductUrl!.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            View compared product: {comparedProductName}
          </a>
        )}
      </CardContent>
    </Card>
  );
}
