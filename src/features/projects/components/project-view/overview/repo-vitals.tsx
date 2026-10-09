"use client";

import { memo } from "react";
import { GitBranch, GitFork, GitCommitHorizontal, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  formatCount,
  formatDate,
  formatRelativeShort,
} from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { useNow } from "./use-now";

export interface RepositoryVitals {
  star?: number | null;
  forks?: number | null;
  branches?: number | null;
  firstCommitAt?: Date | string | null;
  /** Whole days between the first and last commit; null when unknown. */
  spanDays?: number | null;
  lastSyncedAt?: Date | string | null;
}

export type Freshness = "fresh" | "recent" | "stale";

export interface SyncFreshness {
  freshness: Freshness;
  label: string;
  className: string;
}

/**
 * How long ago the repository was last pulled from GitHub.
 *
 * One hour is the freshness window an on-demand sync implies — data fetched in
 * the last hour cannot have meaningfully drifted. Past a day the project may have
 * moved on GitHub without this copy knowing, which is worth flagging; past a week
 * the index is describing history that has probably been rewritten. The
 * distinction the old drawer could not make is between *the index was built* and
 * *the repository was fetched*, and only the second one is what staleness means
 * here.
 */
export function describeSyncFreshness(
  at: Date | string | null | undefined,
  now: Date,
): SyncFreshness {
  const time = at instanceof Date ? at : at ? new Date(at) : null;
  const hours =
    time && !Number.isNaN(time.getTime())
      ? (now.getTime() - time.getTime()) / 3_600_000
      : Number.POSITIVE_INFINITY;

  if (hours <= 1) {
    return {
      freshness: "fresh",
      label: "Synced just now",
      className: "text-gv-moss",
    };
  }
  if (hours <= 24) {
    return {
      freshness: "recent",
      label: `Synced ${formatRelativeShort(at!, now)}`,
      className: "text-muted-foreground",
    };
  }
  return {
    freshness: "stale",
    label: `Stale · ${formatRelativeShort(at!, now)}`,
    className: "text-gv-amber",
  };
}

function Vital({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        {label}
      </p>
      <p className="text-foreground mt-1 truncate text-sm font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

interface RepositoryVitalsBandProps {
  vitals?: RepositoryVitals;
  isLoading?: boolean;
}

function RepositoryVitalsBand({
  vitals,
  isLoading,
}: RepositoryVitalsBandProps) {
  const now = useNow();
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="bg-muted/30 h-3 w-16 rounded" />
            <div className="bg-muted/40 h-4 w-12 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const { star, forks, branches, firstCommitAt, spanDays, lastSyncedAt } =
    vitals ?? {};

  // `useNow`, not `new Date()`: this band is server-rendered, and a
  // `typeof window` guard only separates SSR from the browser — the server pass
  // and the hydration pass are both in a browser and are the two that disagree.
  const freshness = now ? describeSyncFreshness(lastSyncedAt, now) : null;

  const figures = [
    {
      key: "stars",
      label: "Stars",
      value: star == null ? "—" : formatCount(star),
      icon: Star,
    },
    {
      key: "forks",
      label: "Forks",
      value: forks == null ? "—" : formatCount(forks),
      icon: GitFork,
    },
    {
      key: "branches",
      label: "Branches",
      value: branches == null ? "—" : formatCount(branches),
      icon: GitBranch,
    },
    {
      key: "span",
      label: "History",
      // A repository with a single commit has no span; "0d" would read as
      // "written today" rather than "not enough history to measure".
      value:
        spanDays === null || spanDays === undefined
          ? "—"
          : `${formatCount(spanDays)}d`,
      icon: GitCommitHorizontal,
    },
  ];

  return (
    <section
      aria-label="Repository vitals"
      className="border-border border-t pt-5"
    >
      <h3 className="text-muted-foreground mb-4 text-xs font-medium tracking-wide uppercase">
        Repository
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {figures.map((figure) => (
          <Vital
            key={figure.key}
            icon={figure.icon}
            label={figure.label}
            value={figure.value}
          />
        ))}
      </div>

      <div className="text-muted-foreground border-border/60 mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3 text-[11px]">
        <span>
          {firstCommitAt
            ? `First commit ${formatDate(firstCommitAt)}`
            : "No commit history synced yet"}
        </span>
        {firstCommitAt && spanDays !== null && spanDays !== undefined && (
          <>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {formatCount(spanDays)} days of history
            </span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span className={cn(freshness?.className)}>
          {freshness
            ? freshness.label
            : lastSyncedAt
              ? "Sync time unavailable"
              : "Never synced"}
        </span>
      </div>
    </section>
  );
}

export { RepositoryVitalsBand };
export default memo(RepositoryVitalsBand);
