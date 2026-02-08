"use client";

import { useState, useCallback } from "react";
import type {
  ShoppingSpec,
  DiscoveryResults,
  RankedResults,
} from "@/lib/types";
import { discoverProducts, rankProducts } from "@/lib/api";

export interface DiscoveryProgress {
  category: string;
  status: "pending" | "searching" | "done";
}

export function useDiscovery() {
  const [discoveryResults, setDiscoveryResults] =
    useState<DiscoveryResults | null>(null);
  const [rankedResults, setRankedResults] = useState<RankedResults | null>(
    null
  );
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isRanking, setIsRanking] = useState(false);
  const [progress, setProgress] = useState<DiscoveryProgress[]>([]);

  const runPipeline = useCallback(
    async (
      spec: ShoppingSpec
    ): Promise<RankedResults | null> => {
      setIsDiscovering(true);
      setIsRanking(false);

      const initialProgress: DiscoveryProgress[] = spec.items_needed.map(
        (item) => ({
          category: item.category,
          status: "pending",
        })
      );
      setProgress(initialProgress);

      try {
        for (let i = 0; i < spec.items_needed.length; i++) {
          setProgress((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, status: "searching" } : p
            )
          );
          await new Promise((r) => setTimeout(r, 200));
        }

        const results = await discoverProducts(spec);
        setDiscoveryResults(results);

        setProgress((prev) => prev.map((p) => ({ ...p, status: "done" })));
        setIsDiscovering(false);

        setIsRanking(true);
        const ranked = await rankProducts(results, spec);
        setRankedResults(ranked);
        setIsRanking(false);

        return ranked;
      } catch (error) {
        console.error("Discovery pipeline error:", error);
        setIsDiscovering(false);
        setIsRanking(false);
        return null;
      }
    },
    []
  );

  return {
    discoveryResults,
    rankedResults,
    isDiscovering,
    isRanking,
    progress,
    runPipeline,
  };
}
