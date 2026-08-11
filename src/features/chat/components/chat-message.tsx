"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { User, Bot, Copy, Check, FileText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { CodeBlock } from "./code-block";
import { Badge } from "@/src/shared/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/shared/components/ui/tooltip";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  relatedFiles?: string[];
  isStreaming?: boolean;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"
          style={{ animationDelay: "0ms", animationDuration: "1.2s" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"
          style={{ animationDelay: "150ms", animationDuration: "1.2s" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"
          style={{ animationDelay: "300ms", animationDuration: "1.2s" }}
        />
      </div>
      <span className="text-muted-foreground/60 animate-pulse text-xs">
        Thinking...
      </span>
    </div>
  );
}

export function ChatMessage({
  role,
  content,
  relatedFiles,
  isStreaming,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isUser && isStreaming && !content) {
    return (
      <div className="group flex gap-3 px-4 py-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex max-w-[85%] flex-col items-start gap-2">
          <div className="bg-muted/40 border-border/30 rounded-2xl rounded-tl-md border px-4 py-3">
            <ThinkingIndicator />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("group flex gap-3 px-4 py-5", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-primary/10 text-primary"
            : "bg-emerald-500/10 text-emerald-500",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "relative rounded-2xl px-4 py-3",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : "bg-muted/40 border-border/30 rounded-tl-md border",
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="chat-markdown prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isInline = !match && !className;

                    if (isInline) {
                      return (
                        <code
                          className="rounded-md border border-white/6 bg-white/6 px-1.5 py-0.5 font-mono text-[13px] text-emerald-300/90"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }

                    return (
                      <CodeBlock language={match?.[1]} className={className}>
                        {children}
                      </CodeBlock>
                    );
                  },
                  pre({ children }) {
                    return <>{children}</>;
                  },
                  p({ children }) {
                    return (
                      <p className="text-foreground/90 mb-3 leading-[1.75] last:mb-0">
                        {children}
                      </p>
                    );
                  },
                  ul({ children }) {
                    return (
                      <ul className="text-foreground/85 mb-3 list-disc space-y-1.5 pl-5 marker:text-emerald-500/50">
                        {children}
                      </ul>
                    );
                  },
                  ol({ children }) {
                    return (
                      <ol className="text-foreground/85 mb-3 list-decimal space-y-1.5 pl-5 marker:text-emerald-500/50">
                        {children}
                      </ol>
                    );
                  },
                  li({ children }) {
                    return <li className="leading-[1.65]">{children}</li>;
                  },
                  h1({ children }) {
                    return (
                      <h1 className="text-foreground border-border/30 mt-5 mb-3 border-b pb-2 text-lg font-bold first:mt-0">
                        {children}
                      </h1>
                    );
                  },
                  h2({ children }) {
                    return (
                      <h2 className="text-foreground mt-4 mb-2 text-base font-semibold first:mt-0">
                        {children}
                      </h2>
                    );
                  },
                  h3({ children }) {
                    return (
                      <h3 className="text-foreground mt-3 mb-1.5 text-sm font-semibold first:mt-0">
                        {children}
                      </h3>
                    );
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="text-muted-foreground my-3 border-l-2 border-emerald-500/30 pl-4 italic">
                        {children}
                      </blockquote>
                    );
                  },
                  strong({ children }) {
                    return (
                      <strong className="text-foreground font-semibold">
                        {children}
                      </strong>
                    );
                  },
                  a({ children, href }) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 underline decoration-emerald-400/30 underline-offset-2 transition-colors hover:text-emerald-300 hover:decoration-emerald-400/60"
                      >
                        {children}
                      </a>
                    );
                  },
                  hr() {
                    return <hr className="border-border/30 my-4" />;
                  },
                  table({ children }) {
                    return (
                      <div className="border-border/30 my-3 overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">{children}</table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return (
                      <th className="border-border/30 bg-muted/30 text-foreground border-b px-3 py-2 text-left text-xs font-semibold">
                        {children}
                      </th>
                    );
                  },
                  td({ children }) {
                    return (
                      <td className="border-border/10 text-foreground/80 border-b px-3 py-2">
                        {children}
                      </td>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-full bg-emerald-400/80 align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Actions + Related Files */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 px-1",
            isUser && "flex-row-reverse",
          )}
        >
          {/* Copy button */}
          <button
            onClick={handleCopy}
            aria-label={
              copied ? "Message copied to clipboard" : "Copy message content"
            }
            className="text-muted-foreground hover:text-foreground cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Related file badges */}
          {relatedFiles && relatedFiles.length > 0 && (
            <TooltipProvider>
              <div className="flex flex-wrap gap-1">
                {relatedFiles.map((file) => (
                  <Tooltip key={file}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="border-border/50 bg-muted/30 text-muted-foreground cursor-default gap-1 font-mono text-[10px]"
                      >
                        <FileText className="h-2.5 w-2.5" />
                        {file.split("/").pop()}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="font-mono text-xs">{file}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
}
