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
  DollarSign,
  Timer,
  Ruler,
  CheckCircle,
  Search,
} from "lucide-react";
import type { ShoppingSpec } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

interface ShoppingSpecCardProps {
  spec: ShoppingSpec;
  onConfirm: () => void;
}

export function ShoppingSpecCard({ spec, onConfirm }: ShoppingSpecCardProps) {
  const mustHave = spec.items_needed.filter(
    (i) => i.priority === "must_have"
  );
  const niceToHave = spec.items_needed.filter(
    (i) => i.priority === "nice_to_have"
  );

  return (
    <Card className="w-full border-blue-500/30 bg-blue-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-blue-500" />
          Shopping Specification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Constraints */}
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-green-500" />
            <span>${spec.constraints.budget.total}</span>
          </div>
          {spec.constraints.size?.toUpperCase() !== "N/A" && (
            <div className="flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 text-blue-500" />
              <span>Size {spec.constraints.size}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-orange-500" />
            <span>By {spec.constraints.delivery_deadline}</span>
          </div>
        </div>

        <Separator />

        {/* Must-have items */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Essential Items ({mustHave.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {mustHave.map((item) => (
              <Badge key={item.category} variant="default" className="text-xs">
                {CATEGORY_LABELS[item.category]}
              </Badge>
            ))}
          </div>
        </div>

        {/* Nice-to-have items */}
        {niceToHave.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Optional Items ({niceToHave.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {niceToHave.map((item) => (
                <Badge
                  key={item.category}
                  variant="secondary"
                  className="text-xs"
                >
                  {CATEGORY_LABELS[item.category]}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={onConfirm} className="w-full" size="sm">
          <Search className="h-4 w-4 mr-2" />
          Confirm & Search Retailers
        </Button>
      </CardFooter>
    </Card>
  );
}
