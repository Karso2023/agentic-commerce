"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { ChatMessage } from "@/lib/types";

export interface ChatSessionRow {
  id: string;
  title: string | null;
  messages: unknown;
  created_at: string;
  updated_at: string;
}

const supabase = createClient();

export const CHAT_SESSION_STORAGE_KEY = "loadChatSession";

function titleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (firstUser && typeof firstUser.content === "string") {
    const t = firstUser.content.slice(0, 50);
    return t.length < firstUser.content.length ? `${t}…` : t;
  }
  return "Chat";
}

export function useChatHistory(userId: string | undefined) {
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const currentIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_history")
      .select("id, title, messages, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    setLoading(false);
    if (error) {
      console.error("Failed to fetch chat history:", error);
      return;
    }
    setSessions((data ?? []) as ChatSessionRow[]);
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const getSession = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("chat_history")
      .select("messages, title")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return {
      messages: (data.messages as ChatMessage[]) ?? [],
      title: (data.title as string) ?? null,
    };
  }, []);

  const saveSession = useCallback(
    async (messages: ChatMessage[], options?: { id?: string | null; title?: string }) => {
      if (!userId) return;
      const title = options?.title ?? titleFromMessages(messages);
      const payload = {
        user_id: userId,
        title,
        messages: messages.map((m) => ({
          ...m,
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
        })),
        updated_at: new Date().toISOString(),
      };
      if (options?.id) {
        await supabase
          .from("chat_history")
          .update({ title: payload.title, messages: payload.messages, updated_at: payload.updated_at })
          .eq("id", options.id)
          .eq("user_id", userId);
      } else {
        const { data } = await supabase
          .from("chat_history")
          .insert({ user_id: userId, title, messages: payload.messages })
          .select("id")
          .single();
        if (data?.id) currentIdRef.current = data.id as string;
      }
      await fetchSessions();
    },
    [userId, fetchSessions]
  );

  const debouncedSave = useCallback(
    (messages: ChatMessage[]) => {
      if (!userId || messages.every((m) => m.role !== "user")) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        saveSession(messages, { id: currentIdRef.current });
      }, 2000);
    },
    [userId, saveSession]
  );

  const clearCurrentSessionId = useCallback(() => {
    currentIdRef.current = null;
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from("chat_history")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      if (currentIdRef.current === id) currentIdRef.current = null;
      await fetchSessions();
    },
    [userId, fetchSessions]
  );

  const deleteAllSessions = useCallback(
    async () => {
      if (!userId) return;
      const { error } = await supabase
        .from("chat_history")
        .delete()
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      currentIdRef.current = null;
      await fetchSessions();
    },
    [userId, fetchSessions]
  );

  return {
    sessions,
    loading,
    getSession,
    saveSession,
    debouncedSave,
    clearCurrentSessionId,
    deleteSession,
    deleteAllSessions,
    refetch: fetchSessions,
  };
}
