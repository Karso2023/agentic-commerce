"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Snowflake, RotateCcw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatMessage } from "./ChatMessage";
import { ShoppingSpecCard } from "./ShoppingSpecCard";
import { ProgressIndicator } from "./ProgressIndicator";
import { VoiceInputButton } from "./VoiceInputButton";
import type { ChatMessage as ChatMessageType, AppState } from "@/lib/types";
import type { DiscoveryProgress } from "@/hooks/useDiscovery";

interface ChatUIProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  flowState: AppState;
  progress: DiscoveryProgress[];
  isRanking: boolean;
  onSendMessage: (text: string) => void;
  onConfirmSpec: () => void;
  onReset: () => void;
}

export function ChatUI({
  messages,
  isLoading,
  flowState,
  progress,
  isRanking,
  onSendMessage,
  onConfirmSpec,
  onReset,
}: ChatUIProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, progress]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Snowflake className="h-5 w-5 text-blue-500" />
          <h2 className="text-sm font-semibold">Shopping Agent</h2>
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden md:inline">
            <ThemeToggle />
          </span>
          <Button variant="ghost" size="icon" onClick={onReset} className="h-8 w-8" aria-label="Reset chat">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages — scrollable so user can scroll to confirm next request */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4"
          role="region"
          aria-label="Chat messages"
        >
          <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id}>
              <ChatMessage message={message} />
              {message.spec && flowState === "confirming" && (
                <div className="mt-3 ml-11">
                  <ShoppingSpecCard
                    spec={message.spec}
                    onConfirm={onConfirmSpec}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Progress indicator during discovery */}
          {(flowState === "discovering" || flowState === "ranking") &&
            progress.length > 0 && (
              <div className="ml-11">
                <ProgressIndicator
                  progress={progress}
                  isRanking={isRanking}
                />
              </div>
            )}

          {/* Loading indicator */}
          {isLoading && flowState === "parsing" && (
            <div className="ml-11 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">
                <span className="animate-bounce delay-0">.</span>
                <span className="animate-bounce delay-100">.</span>
                <span className="animate-bounce delay-200">.</span>
              </div>
              <span>Analyzing your request</span>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Input — always visible so user can keep typing (e.g. after confirming or during discovery) */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want to buy (e.g. skiing gear, gaming headset, running shoes)..."
            disabled={isLoading}
            className="flex-1"
          />
          <VoiceInputButton
            onTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
            onStopWithSend={(text) => {
              setInput("");
              onSendMessage(text);
            }}
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
