"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { w: 48, h: 48, cls: "w-12 h-12" },
  md: { w: 80, h: 80, cls: "w-20 h-20" },
  lg: { w: 120, h: 120, cls: "w-30 h-30" },
};

export function ProductImage({ src, alt, size = "md" }: ProductImageProps) {
  const [error, setError] = useState(false);
  const { w, h, cls } = SIZES[size];

  if (!src || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-muted",
          cls
        )}
      >
        <Package className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-md", cls)}>
      <Image
        src={src}
        alt={alt}
        width={w}
        height={h}
        className="object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
}
