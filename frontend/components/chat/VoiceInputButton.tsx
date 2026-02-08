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
import { transcribeAudio } from "@/lib/api";

/** Desktop: click to start, click again to stop & send. Mobile: press to speak (fill input only). */
function isDesktop(): boolean {
  if (typeof window === "undefined") return true;
  return !/Mobi|Tablet|Android/i.test(navigator.userAgent);
}

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onStopWithSend?: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({
  onTranscript,
  onStopWithSend,
  disabled = false,
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const desktop = typeof window !== "undefined" && isDesktop();
  const sendOnStop = desktop && typeof onStopWithSend === "function";

  const toggleListening = useCallback(async () => {
    if (disabled) return;

    if (isListening || isTranscribing) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        setIsListening(false);
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mime });
        setIsTranscribing(true);
        try {
          const { text } = await transcribeAudio(blob);
          const trimmed = text.trim();
          if (trimmed) {
            if (sendOnStop && onStopWithSend) {
              onStopWithSend(trimmed);
            } else {
              onTranscript(trimmed);
            }
          }
        } catch (err) {
          console.warn("Transcription failed:", err);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsListening(true);
    } catch (err) {
      console.warn("Microphone access failed:", err);
    }
  }, [isListening, isTranscribing, disabled, onTranscript, sendOnStop, onStopWithSend]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const busy = isListening || isTranscribing;
  const tooltipText = desktop
    ? busy
      ? isTranscribing
        ? "Transcribing..."
        : "Click again to stop & send"
      : "Click to start recording (OpenAI Whisper)"
    : busy
      ? isTranscribing
        ? "Transcribing..."
        : "Listening… Press again to stop"
      : "Press to speak (OpenAI Whisper)";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={busy ? "default" : "outline"}
            size="icon"
            disabled={disabled}
            onClick={toggleListening}
            className={busy ? "animate-pulse" : ""}
            aria-label={busy ? "Stop and send" : "Start voice input"}
          >
            {busy ? (
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
