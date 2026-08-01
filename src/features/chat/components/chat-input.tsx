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
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-end gap-2 rounded-xl border border-border/50 bg-card/50 p-2 transition-colors focus-within:border-border",
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        rows={1}
        className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {isLoading && onStop ? (
        <Button
          onClick={onStop}
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </Button>
      ) : (
        <Button
          onClick={onSubmit}
          disabled={!value.trim() || isLoading}
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-lg transition-colors cursor-pointer",
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
