import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns true only for non-empty http/https URLs suitable for product links. */
export function isValidProductUrl(url: string | null | undefined): boolean {
  if (url == null || typeof url !== "string") return false
  const s = url.trim()
  if (!s) return false
  if (!s.startsWith("http://") && !s.startsWith("https://")) return false
  try {
    const u = new URL(s)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}
