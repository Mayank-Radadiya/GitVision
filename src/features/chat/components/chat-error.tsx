"use client";

import {
  AlertTriangle,
  Clock,
  CreditCard,
  FolderX,
  MessageSquareOff,
  ServerCrash,
  ShieldAlert,
  Timer,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { ChatErrorInfo } from "@/src/shared/lib/chat-errors";

const ERROR_ICONS: Partial<Record<ChatErrorInfo["code"], LucideIcon>> = {
  rate_limited: Timer,
  out_of_credits: CreditCard,
  timeout: Clock,
  project_not_found: FolderX,
  chat_not_found: MessageSquareOff,
  unauthorized: ShieldAlert,
  network: WifiOff,
  model_error: ServerCrash,
  server_error: ServerCrash,
};

interface ChatErrorCardProps {
  error: ChatErrorInfo;
  onRetry: () => void;
}

/**
 * Categorized error banner for the chat. Shows the real server message and a
 * "Try again" action only when retrying is safe (e.g. not for credit/404s).
 */
export function ChatErrorCard({ error, onRetry }: ChatErrorCardProps) {
  const Icon = ERROR_ICONS[error.code] ?? AlertTriangle;

  return (
    <div className="px-4 pb-2">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-500">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="min-w-0">
            <span className="font-medium">{error.title}:</span>{" "}
            <span className="text-red-500/90">{error.message}</span>
          </span>
        </div>
        {error.retryable && (
          <button
            onClick={onRetry}
            className="shrink-0 cursor-pointer underline hover:no-underline"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
