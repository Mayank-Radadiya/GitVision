"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { User, Bot, Copy, Check, FileText } from "lucide-react";
import { useState } from "react";
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
          className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce"
          style={{ animationDelay: "0ms", animationDuration: "1.2s" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce"
          style={{ animationDelay: "150ms", animationDuration: "1.2s" }}
        />
        <span
          className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce"
          style={{ animationDelay: "300ms", animationDuration: "1.2s" }}
        />
      </div>
      <span className="text-xs text-muted-foreground/60 animate-pulse">
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
        <div className="flex max-w-[85%] flex-col gap-2 items-start">
          <div className="rounded-2xl rounded-tl-md bg-muted/40 border border-border/30 px-4 py-3">
            <ThinkingIndicator />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex gap-3 px-4 py-5 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUser
            ? "bg-primary/10 text-primary"
            : "bg-emerald-500/10 text-emerald-500"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message content */}
      <div
        className={`flex max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`relative rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : "bg-muted/40 border border-border/30 rounded-tl-md"
          }`}
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
                          className="rounded-md bg-white/[0.06] border border-white/[0.06] px-1.5 py-0.5 font-mono text-[13px] text-emerald-300/90"
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
                      <p className="mb-3 last:mb-0 leading-[1.75] text-foreground/90">
                        {children}
                      </p>
                    );
                  },
                  ul({ children }) {
                    return (
                      <ul className="mb-3 list-disc pl-5 space-y-1.5 text-foreground/85 marker:text-emerald-500/50">
                        {children}
                      </ul>
                    );
                  },
                  ol({ children }) {
                    return (
                      <ol className="mb-3 list-decimal pl-5 space-y-1.5 text-foreground/85 marker:text-emerald-500/50">
                        {children}
                      </ol>
                    );
                  },
                  li({ children }) {
                    return <li className="leading-[1.65]">{children}</li>;
                  },
                  h1({ children }) {
                    return (
                      <h1 className="mb-3 mt-5 first:mt-0 text-lg font-bold text-foreground border-b border-border/30 pb-2">
                        {children}
                      </h1>
                    );
                  },
                  h2({ children }) {
                    return (
                      <h2 className="mb-2 mt-4 first:mt-0 text-base font-semibold text-foreground">
                        {children}
                      </h2>
                    );
                  },
                  h3({ children }) {
                    return (
                      <h3 className="mb-1.5 mt-3 first:mt-0 text-sm font-semibold text-foreground">
                        {children}
                      </h3>
                    );
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="my-3 border-l-2 border-emerald-500/30 pl-4 italic text-muted-foreground">
                        {children}
                      </blockquote>
                    );
                  },
                  strong({ children }) {
                    return (
                      <strong className="font-semibold text-foreground">
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
                    return <hr className="my-4 border-border/30" />;
                  },
                  table({ children }) {
                    return (
                      <div className="my-3 overflow-x-auto rounded-lg border border-border/30">
                        <table className="w-full text-sm">{children}</table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return (
                      <th className="border-b border-border/30 bg-muted/30 px-3 py-2 text-left text-xs font-semibold text-foreground">
                        {children}
                      </th>
                    );
                  },
                  td({ children }) {
                    return (
                      <td className="border-b border-border/10 px-3 py-2 text-foreground/80">
                        {children}
                      </td>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block h-4 w-[3px] animate-pulse rounded-full bg-emerald-400/80 ml-0.5 align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Actions + Related Files */}
        <div
          className={`flex flex-wrap items-center gap-2 px-1 ${isUser ? "flex-row-reverse" : ""}`}
        >
          {/* Copy button */}
          <button
            onClick={handleCopy}
            aria-label={copied ? "Message copied to clipboard" : "Copy message content"}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer"
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
                        className="cursor-default gap-1 text-[10px] font-mono border-border/50 bg-muted/30 text-muted-foreground"
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
