"use client";

import { useState, useCallback } from "react";
import type {
  ChatMessage,
  ShoppingSpec,
  ClarifyingQuestion,
  AppState,
} from "@/lib/types";
import { parseIntent } from "@/lib/api";

function isClarification(
  result: ShoppingSpec | ClarifyingQuestion
): result is ClarifyingQuestion {
  return "is_clarification" in result && result.is_clarification === true;
}

function createMessage(
  role: ChatMessage["role"],
  content: string,
  spec?: ShoppingSpec
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    spec,
    timestamp: new Date(),
  };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      "assistant",
      "Welcome to Agentic Commerce! Tell me what you want to buy — skiing gear, gaming setup, running shoes, or anything else. Include your budget, size (if relevant), and delivery timeline. For example: \"Gaming headset and keyboard, budget $200\" or \"Running shoes size 10, under $100.\""
    ),
  ]);
  const [spec, setSpec] = useState<ShoppingSpec | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [flowState, setFlowState] = useState<AppState>("idle");

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setMessages((prev) => [...prev, createMessage("user", text)]);
      setIsLoading(true);
      setFlowState("parsing");

      try {
        const history = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-10)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        const result = await parseIntent(text, history);

        if (isClarification(result)) {
          setMessages((prev) => [
            ...prev,
            createMessage("assistant", result.question),
          ]);
          setFlowState("idle");
        } else {
          setSpec(result);
          const itemCount = result.items_needed.length;
          const mustHave = result.items_needed.filter(
            (i) => i.priority === "must_have"
          ).length;
          setMessages((prev) => [
            ...prev,
            createMessage(
              "assistant",
              `I've identified ${itemCount} items (${mustHave} essential, ${itemCount - mustHave} optional). Budget: $${result.constraints.budget.total}${result.constraints.size?.toUpperCase() !== "N/A" ? `, Size: ${result.constraints.size}` : ""}, Delivery by: ${result.constraints.delivery_deadline}. Please review and confirm to start searching!`,
              result
            ),
          ]);
          setFlowState("confirming");
        }
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : "Something went wrong";
        setMessages((prev) => [
          ...prev,
          createMessage(
            "assistant",
            `Sorry, I encountered an error: ${errMsg}. Please try again.`
          ),
        ]);
        setFlowState("idle");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  const confirmSpec = useCallback(() => {
    if (!spec) return;
    setFlowState("discovering");
    setMessages((prev) => [
      ...prev,
      createMessage(
        "assistant",
        "Searching across retailers for the best options..."
      ),
    ]);
  }, [spec]);

  const updateFlowState = useCallback((state: AppState) => {
    setFlowState(state);
  }, []);

  const addMessage = useCallback(
    (role: ChatMessage["role"], content: string) => {
      setMessages((prev) => [...prev, createMessage(role, content)]);
    },
    []
  );

  const resetChat = useCallback(() => {
    setMessages([
      createMessage(
        "assistant",
        "Welcome back! Tell me what you want to buy — any category, budget, and preferences."
      ),
    ]);
    setSpec(null);
    setFlowState("idle");
    if (typeof window !== "undefined") window.localStorage.removeItem("agentic-commerce-current-chat");
  }, []);

  /** Restore chat from saved history (e.g. timestamps as ISO strings). */
  const loadSession = useCallback((saved: ChatMessage[]) => {
    const restored: ChatMessage[] = saved.map((m) => ({
      ...m,
      timestamp: typeof m.timestamp === "string" ? new Date(m.timestamp) : m.timestamp,
    }));
    setMessages(restored.length ? restored : [
      createMessage("assistant", "Welcome back! Tell me what you want to buy."),
    ]);
    setSpec(null);
    setFlowState("idle");
  }, []);

  return {
    messages,
    spec,
    isLoading,
    flowState,
    sendMessage,
    confirmSpec,
    updateFlowState,
    addMessage,
    resetChat,
    loadSession,
  };
}
