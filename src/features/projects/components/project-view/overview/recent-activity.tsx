"use client";

import { memo } from "react";
import { GitCommitHorizontal, Inbox, ArrowUpRight } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import {
  formatCount,
  formatRelativeShort,
  formatShortDate,
} from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { initials } from "./top-contributors";
import { useNow } from "./use-now";

export interface RecentCommit {
  id: string;
  hash: string;
  message: string;
  authorName: string | null;
  authorAvatar: string | null;
  authorDate: Date | string | null;
}

export type Recency = "just-now" | "active" | "settled" | "dormant";

export interface RecencyDescription {
  recency: Recency;
  label: string;
  chipClassName: string;
  dotClassName: string;
  /** Long-form sentence for the band's accessible name. */
  sentence: string;
}

/**
 * How long ago the newest commit landed, as a judgement rather than a number.
 *
 * Thresholds are picked so that each band corresponds to a change in what a
 * dormant repository means. Two hours is "someone is working right now"; a week
 * is "this moved recently and is worth checking"; a month is "this is seasonal
 * or on hold". Only the last of those is tinted as a warning, because a quiet
 * repository is a normal state and painting it amber would cry wolf.
 *
 * `now` is a parameter rather than read from the clock so the boundaries are
 * testable — `Intl.RelativeTimeFormat` is not.
 */
export function describeRecency(
  at: Date | string | null | undefined,
  now: Date,
): RecencyDescription {
  const time = at instanceof Date ? at : at ? new Date(at) : null;
  const hours =
    time && !Number.isNaN(time.getTime())
      ? (now.getTime() - time.getTime()) / 3_600_000
      : Number.POSITIVE_INFINITY;

  if (hours <= 2) {
    return {
      recency: "just-now",
      label: "Just now",
      chipClassName: "text-gv-moss border-gv-moss/25 bg-gv-moss/10",
      dotClassName: "bg-gv-moss",
      sentence: "A commit landed within the last two hours.",
    };
  }
  if (hours <= 24 * 7) {
    return {
      recency: "active",
      label: "Active",
      chipClassName: "text-gv-moss border-gv-moss/25 bg-gv-moss/10",
      dotClassName: "bg-gv-moss",
      sentence: "The most recent commit landed within the last week.",
    };
  }
  if (hours <= 24 * 30) {
    return {
      recency: "settled",
      label: "Settled",
      chipClassName: "text-muted-foreground border-border bg-muted/40",
      dotClassName: "bg-muted-foreground/60",
      sentence: "The most recent commit landed between a week and a month ago.",
    };
  }
  return {
    recency: "dormant",
    label: "Dormant",
    chipClassName: "text-gv-amber border-gv-amber/25 bg-gv-amber/10",
    dotClassName: "bg-gv-amber",
    sentence: "Nothing has landed for over a month.",
  };
}

interface RecentActivityProps {
  commits?: RecentCommit[];
  isLoading?: boolean;
  /** The aggregate failed. Never rendered as "nothing has landed yet", which
   *  would assert a quiet repository rather than a missing answer. */
  hasFailed?: boolean;
  onViewAll?: () => void;
  githubUrl?: string;
}

function RecentActivity({
  commits,
  isLoading,
  hasFailed,
  onViewAll,
  githubUrl,
}: RecentActivityProps) {
  const now = useNow();

  if (isLoading) {
    return (
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2.5">
            <div className="bg-muted/60 size-6 shrink-0 rounded-full" />
            <div className="bg-muted/30 h-3 flex-1 rounded-full" />
            <div className="bg-muted/20 h-3 w-12 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (hasFailed) {
    return (
      <p
        role="status"
        className="text-muted-foreground bg-muted/30 rounded-md px-3 py-6 text-center text-xs"
      >
        Recent commits couldn’t be loaded.
      </p>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Inbox
          className="text-muted-foreground mb-2 size-5"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">Nothing has landed yet</p>
        <p className="text-muted-foreground mt-1 max-w-56 text-xs">
          No commits have been indexed for this repository.
        </p>
      </div>
    );
  }

  const newest = commits[0]!.authorDate ?? null;
  const recency = describeRecency(newest, now ?? new Date(0));
  // Before mount the chip would be computed against the epoch and claim
  // "Dormant", so it is withheld rather than shown wrong for a frame.
  const canDate = now !== null;
  let repoBase: string | undefined;
  try {
    const url = new URL(githubUrl ?? "");
    if (url.protocol === "https:" && url.hostname === "github.com")
      repoBase = `${url.origin}${url.pathname.replace(/\.git$/, "").replace(/\/$/, "")}`;
  } catch {
    /* Without a valid repository URL, render the commit as text. */
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {canDate ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              recency.chipClassName,
            )}
          >
            <span
              className="relative flex size-1.5 shrink-0"
              aria-hidden="true"
            >
              <span
                className={cn(
                  "relative inline-flex size-1.5 rounded-full",
                  recency.dotClassName,
                )}
              />
            </span>
            {recency.label}
          </span>
        ) : (
          <span
            className="bg-muted/30 h-5 w-16 rounded-full"
            aria-hidden="true"
          />
        )}

        <p className="text-muted-foreground truncate text-[11px] tabular-nums">
          {newest
            ? canDate
              ? `Last commit ${formatRelativeShort(newest, now)}`
              : `Last commit ${formatShortDate(newest)}`
            : "No commit dates available"}
        </p>
      </div>

      <ol aria-label="Recent commits" className="divide-border divide-y">
        {commits.map((commit) => (
          <li
            key={commit.id}
            className="group hover:bg-muted/25 focus-within:bg-muted/25 relative flex items-start gap-3 px-1 py-3.5 transition-colors"
          >
            <span className="text-muted-foreground border-border bg-background mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border">
              <GitCommitHorizontal className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              {repoBase ? (
                <a
                  href={`${repoBase}/commit/${encodeURIComponent(commit.hash)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-primary flex items-start gap-2 rounded-sm text-sm leading-relaxed font-medium transition-colors"
                >
                  <span className="min-w-0 flex-1 break-words">
                    {commit.message || "Untitled commit"}
                  </span>
                  <ArrowUpRight
                    className="text-muted-foreground mt-1 size-3 shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                    aria-label="Open commit on GitHub"
                  />
                </a>
              ) : (
                <p className="text-[13px] leading-relaxed font-medium break-words">
                  {commit.message || "Untitled commit"}
                </p>
              )}
              <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px]">
                <span className="flex items-center gap-1.5">
                  <Avatar className="size-4">
                    <AvatarImage
                      src={commit.authorAvatar || undefined}
                      alt=""
                    />
                    <AvatarFallback className="text-[7px]">
                      {initials(commit.authorName ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-40 truncate">
                    {commit.authorName || "Unknown author"}
                  </span>
                </span>
                <code className="border-border rounded border px-1 py-px text-[10px]">
                  {commit.hash.slice(0, 7)}
                </code>
                <time
                  dateTime={
                    commit.authorDate
                      ? new Date(commit.authorDate).toISOString()
                      : undefined
                  }
                  title={
                    commit.authorDate
                      ? formatShortDate(commit.authorDate)
                      : undefined
                  }
                  className="ml-auto shrink-0 tabular-nums"
                >
                  {canDate && commit.authorDate
                    ? formatRelativeShort(commit.authorDate, now)
                    : commit.authorDate
                      ? formatShortDate(commit.authorDate)
                      : "Date unavailable"}
                </time>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {onViewAll && (
        <p className="border-border/70 flex items-center justify-between gap-2 border-t pt-3 text-[11px]">
          <span className="text-muted-foreground truncate">
            {formatCount(commits.length)} most recent
          </span>
          <button
            type="button"
            onClick={onViewAll}
            className="text-foreground hover:text-primary focus-visible:ring-ring inline-flex shrink-0 items-center gap-1 rounded font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <GitCommitHorizontal className="size-3" aria-hidden="true" />
            All commits
          </button>
        </p>
      )}
    </div>
  );
}

export { RecentActivity };
export default memo(RecentActivity);
