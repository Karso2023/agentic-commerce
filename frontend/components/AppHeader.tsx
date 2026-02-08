"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, History, LogIn, LogOut, UserPlus } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function AppHeader() {
  const { user, signOut, isLoading } = useAuth();
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isAuthPage) return null;

  return (
    <header className="shrink-0 flex items-center justify-end gap-1 sm:gap-2 px-2 py-1.5 border-b border-border/50">
      {!isLoading && (
        <>
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/liked">
                  <Heart className="h-4 w-4 mr-1" />
                  Liked
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/history">
                  <History className="h-4 w-4 mr-1" />
                  History
                </Link>
              </Button>
              <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[120px]">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/login">
                  <LogIn className="h-4 w-4 sm:mr-1" />
                  Log in
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/register">
                  <UserPlus className="h-4 w-4 sm:mr-1" />
                  Register
                </Link>
              </Button>
            </>
          )}
          <ThemeToggle />
        </>
      )}
    </header>
  );
}
