"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RETAILER_COLORS: Record<string, string> = {
  REI: "bg-green-600 hover:bg-green-700 text-white",
  Backcountry: "bg-orange-500 hover:bg-orange-600 text-white",
  evo: "bg-blue-500 hover:bg-blue-600 text-white",
  Amazon: "bg-yellow-500 hover:bg-yellow-600 text-black",
  Moosejaw: "bg-teal-500 hover:bg-teal-600 text-white",
  "The North Face": "bg-red-600 hover:bg-red-700 text-white",
};

export function RetailerBadge({ retailer }: { retailer: string }) {
  const colorClass =
    RETAILER_COLORS[retailer] || "bg-zinc-500 hover:bg-zinc-600 text-white";

  return (
    <Badge className={cn("text-xs font-medium", colorClass)}>{retailer}</Badge>
  );
}
