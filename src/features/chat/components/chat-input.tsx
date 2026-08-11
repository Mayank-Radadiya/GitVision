"use client";

import { useRef, useEffect, KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/src/shared/components/ui/button";
import { cn } from "@/src/shared/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isLoading: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  value = "",
  onChange,
  onSubmit,
  onStop,
  isLoading,
  placeholder = "Ask anything...",
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSubmit();
      }
    }
  };

  return (
    <div
      className={cn(
        "border-border/50 bg-card/50 focus-within:border-border relative flex items-end gap-2 rounded-xl border p-2 transition-colors",
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="placeholder:text-muted-foreground/50 max-h-50 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      {isLoading && !value.trim() && onStop ? (
        <Button
          onClick={onStop}
          size="icon"
          variant="ghost"
          aria-label="Stop generating response"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 shrink-0 cursor-pointer rounded-lg transition-colors"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </Button>
      ) : (
        <Button
          onClick={onSubmit}
          disabled={!value.trim()}
          size="icon"
          aria-label="Send message"
          className={cn(
            "h-8 w-8 shrink-0 cursor-pointer rounded-lg transition-colors",
            value.trim()
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-muted text-muted-foreground",
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
