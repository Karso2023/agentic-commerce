"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useChatHistory } from "@/hooks/useChatHistory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, History } from "lucide-react";
import { CHAT_SESSION_STORAGE_KEY } from "@/hooks/useChatHistory";

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { sessions, loading, getSession } = useChatHistory(user?.id);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) return;
    if (authLoading) return;
    router.replace("/login?redirect=/history");
  }, [user, authLoading, router]);

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    try {
      const data = await getSession(id);
      if (data?.messages?.length) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify({ id, messages: data.messages }));
        }
        router.push("/");
      }
    } finally {
      setLoadingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Chat history
        </h1>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No saved chats yet. Your conversations will appear here once you chat and they are saved.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium truncate">
                      {s.title || "Chat"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.updated_at).toLocaleDateString()}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLoad(s.id)}
                      disabled={loadingId !== null}
                    >
                      {loadingId === s.id ? "Loading…" : "Load"}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
