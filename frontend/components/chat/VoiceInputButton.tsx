"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Web Speech API: constructor type so we can extend Window without referencing a missing global. */
type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
};

interface SpeechRecognitionResultEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined
    : undefined;

/** Desktop/laptop: click to start, click again to stop & send. Mobile/tablet: press to speak (fill input only). */
function isDesktop(): boolean {
  if (typeof window === "undefined") return true;
  return !/Mobi|Tablet|Android/i.test(navigator.userAgent);
}

interface VoiceInputButtonProps {
  /** Called when transcript is ready (mobile: fill input; desktop: also used if onStopWithSend not provided). */
  onTranscript: (text: string) => void;
  /** On desktop: when user stops recording, call this to send the message immediately. */
  onStopWithSend?: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({
  onTranscript,
  onStopWithSend,
  disabled = false,
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported] = useState(() => !!SpeechRecognitionAPI);
  const recognitionRef = useRef<InstanceType<NonNullable<typeof SpeechRecognitionAPI>> | null>(null);
  const transcriptRef = useRef("");

  const desktop = typeof window !== "undefined" && isDesktop();
  const sendOnStop = desktop && typeof onStopWithSend === "function";

  const toggleListening = useCallback(() => {
    if (!SpeechRecognitionAPI || disabled) return;

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    transcriptRef.current = "";
    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      const text = transcriptRef.current.trim();
      if (text) {
        if (sendOnStop && onStopWithSend) {
          onStopWithSend(text);
        } else {
          onTranscript(text);
        }
      }
    };

    recognition.onerror = (event: { error: string }) => {
      recognitionRef.current = null;
      setIsListening(false);
      if (event.error !== "aborted") {
        console.warn("Speech recognition error:", event.error);
      }
    };

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      transcriptRef.current = transcript;
    };

    recognition.start();
  }, [isListening, disabled, onTranscript, sendOnStop, onStopWithSend]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  if (!supported) {
    return null;
  }

  const tooltipText = desktop
    ? isListening
      ? "Click again to stop & send"
      : "Click to start recording"
    : isListening
      ? "Listening… Press again to stop"
      : "Press to speak";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={isListening ? "default" : "outline"}
            size="icon"
            disabled={disabled}
            onClick={toggleListening}
            className={isListening ? "animate-pulse" : ""}
            aria-label={isListening ? "Stop and send" : "Start voice input"}
          >
            {isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
