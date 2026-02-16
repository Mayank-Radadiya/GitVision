"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useCallback } from "react";
import { ArrowLeft, FolderGit2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/shared/components/ui/button";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { motion, AnimatePresence } from "framer-motion";

interface ChatRoomProps {
  chatId: string;
  projectId?: string | null;
  projectName?: string;
  type: "project" | "general";
  title: string;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    relatedFiles?: unknown;
    createdAt: Date;
  }>;
}

export function ChatRoom({
  chatId,
  projectId,
  projectName,
  type,
  title,
  initialMessages = [],
}: ChatRoomProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
  } = useChat({
    api: "/api/chat",
    body: {
      chatId,
      projectId: projectId ?? undefined,
      mode: type,
    },
    initialMessages: initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })),
  });

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const onSubmit = () => {
    if (!input.trim() || isLoading) return;
    handleSubmit();
  };

  const getRelatedFiles = (messageId: string): string[] => {
    const original = initialMessages.find((m) => m.id === messageId);
    if (original?.relatedFiles && Array.isArray(original.relatedFiles)) {
      return original.relatedFiles as string[];
    }
    return [];
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/chat")}
          className="h-8 w-8 shrink-0 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {type === "project" ? (
            <FolderGit2 className="h-4 w-4 shrink-0 text-blue-500" />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
          )}
          <h1 className="truncate text-sm font-medium">{title}</h1>
          {projectName && (
            <span className="shrink-0 text-xs text-muted-foreground font-mono">
              · {projectName}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md text-center">
              <h2 className="text-lg font-semibold">
                {type === "project"
                  ? `Ask about ${projectName ?? "your project"}`
                  : "Start a conversation"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {type === "project"
                  ? "I've indexed your codebase. Ask me to explain logic, find bugs, or suggest refactors."
                  : "Ask any programming question — algorithms, system design, or debugging help."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {(type === "project"
                  ? [
                      "Where is authentication handled?",
                      "Explain the project structure",
                      "How does the API layer work?",
                    ]
                  : [
                      "Explain React Server Components",
                      "Best practices for API design",
                      "Explain TCP vs UDP",
                    ]
                ).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="cursor-pointer rounded-lg border border-border/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl pb-4">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChatMessage
                    role={m.role as "user" | "assistant"}
                    content={m.content}
                    relatedFiles={getRelatedFiles(m.id)}
                    isStreaming={
                      isLoading &&
                      i === messages.length - 1 &&
                      m.role === "assistant"
                    }
                  />
                </motion.div>
              ))}
              {isLoading &&
                messages.length > 0 &&
                messages[messages.length - 1].role === "user" && (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <ChatMessage
                      role="assistant"
                      content=""
                      isStreaming={true}
                    />
                  </motion.div>
                )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-2">
          <div className="mx-auto max-w-3xl rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-center text-sm text-red-500">
            Something went wrong.{" "}
            <button
              onClick={() => reload()}
              className="cursor-pointer underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/40 px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={onSubmit}
            onStop={stop}
            isLoading={isLoading}
            placeholder={
              type === "project"
                ? `Ask about ${projectName ?? "the codebase"}...`
                : "Ask anything..."
            }
          />
          <p className="mt-2 text-center text-[10px] text-muted-foreground/40">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
