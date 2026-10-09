"use client";

import type { ComponentProps, ReactNode } from "react";
import { AlertCircle, Inbox, Search } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function ProjectPanel({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "project-panel border-border bg-card min-w-0 rounded-xl border p-5 sm:p-6",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function PanelHeading({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 id={id} className="text-sm font-semibold tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ListToolbar({
  search,
  onSearchChange,
  label,
  placeholder,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  label: string;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-[1_1_240px]">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          aria-label={label}
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-9"
        />
      </div>
      {children}
    </div>
  );
}

export function ProjectStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
        {
          "bg-muted text-muted-foreground": tone === "neutral",
          "bg-gv-moss/10 text-gv-moss": tone === "success",
          "bg-gv-amber/10 text-gv-amber": tone === "warning",
          "bg-destructive/10 text-destructive": tone === "error",
        },
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <div className="border-border bg-background mb-4 flex size-10 items-center justify-center rounded-xl border">
        <Inbox className="text-muted-foreground size-4" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function InlineError({
  message,
  onRetry,
  pending = false,
}: {
  message: string;
  onRetry: () => void;
  pending?: boolean;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/20 bg-destructive/5 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <AlertCircle
        className="text-destructive size-4 shrink-0"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1">{message}</p>
      <Button variant="ghost" size="sm" onClick={onRetry} disabled={pending}>
        {pending ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      aria-label="Loading results"
      aria-busy="true"
      className="divide-border divide-y"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
