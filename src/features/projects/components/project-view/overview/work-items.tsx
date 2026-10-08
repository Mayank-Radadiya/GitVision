"use client";

/**
 * Work-item health — open issues and pull requests, and how long they have been
 * waiting.
 *
 * Two open bars rather than a donut. A donut answers "what fraction of the whole
 * is this part", and that is not the question: nobody asks what fraction of the
 * issues are issues. What a person wants to know is "is there a backlog, and is
 * it growing or draining" — which is two magnitudes against a shared scale, and
 * that is what paired bars show directly.
 *
 * `medianOpenAgeDays` is the staleness signal. A repo with 40 open issues that
 * are all a day old is healthy; the same 40 open for a year is not, and the count
 * alone cannot tell those apart.
 */

import { memo } from "react";
import { CircleDot, GitPullRequest, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { formatCount } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

export interface WorkSummary {
  openIssues: number;
  closedIssues: number;
  openPullRequests: number;
  mergedPullRequests: number;
  medianOpenAgeDays: number | null;
}

/**
 * Age buckets. The thresholds are chosen against how people actually read an
 * ageing issue, not against round numbers: within a week is fresh, within a
 * month is fine, within a quarter is starting to matter, past that is stale.
 */
function ageTone(days: number | null): {
  label: string;
  className: string;
} {
  if (days === null) {
    return { label: "No open items", className: "text-muted-foreground" };
  }
  if (days <= 7) return { label: "Fresh", className: "text-gv-moss" };
  if (days <= 30) return { label: "On track", className: "text-gv-moss" };
  if (days <= 90)
    return { label: "Ageing", className: "text-gv-amber" };
  return { label: "Stale", className: "text-gv-ember" };
}

function OpenBar({
  icon: Icon,
  label,
  open,
  resolved,
  closedLabel,
  max,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  open: number;
  resolved: number;
  closedLabel: string;
  max: number;
  tone: string;
  onClick?: () => void;
}) {
  const width = max > 0 ? Math.max((open / max) * 100, open > 0 ? 2 : 0) : 0;
  const total = open + resolved;
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          {label}
        </span>
        <span className="text-foreground text-xs font-semibold tabular-nums">
          {formatCount(open)}
          <span className="text-muted-foreground font-normal"> open</span>
        </span>
      </div>
      <div className="bg-muted/50 h-1.5 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone)}
          style={{ width: `${width}%` }}
          role="img"
          aria-label={`${formatCount(open)} open ${label.toLowerCase()}${
            resolved > 0
              ? `, ${formatCount(resolved)} ${closedLabel}`
              : ""
          }`}
        />
      </div>
      <p className="text-muted-foreground text-[11px] tabular-nums">
        {resolved > 0 ? `${formatCount(resolved)} ${closedLabel}` : "None resolved yet"}
      </p>
    </div>
  );
}

interface WorkItemsProps {
  work?: WorkSummary;
  isLoading?: boolean;
  onOpenIssues?: () => void;
  onOpenPullRequests?: () => void;
}

function WorkItems({
  work,
  isLoading,
  onOpenIssues,
  onOpenPullRequests,
}: WorkItemsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <div className="bg-muted/40 h-3 w-24 rounded" />
        <div className="bg-muted/30 h-1.5 w-full rounded-full" />
        <div className="bg-muted/40 h-3 w-24 rounded" />
        <div className="bg-muted/30 h-1.5 w-full rounded-full" />
      </div>
    );
  }

  if (!work || (work.openIssues === 0 && work.openPullRequests === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Inbox className="text-muted-foreground mb-2 size-5" aria-hidden="true" />
        <p className="text-sm font-medium">Nothing open</p>
        <p className="text-muted-foreground mt-1 max-w-56 text-xs">
          No open issues or pull requests have been synced from GitHub.
        </p>
      </div>
    );
  }

  const max = Math.max(work.openIssues, work.openPullRequests, 1);
  const tone = ageTone(work.medianOpenAgeDays);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-xs font-medium", tone.className)}>
          Median open age: {work.medianOpenAgeDays ?? 0}d
          <span className="text-muted-foreground font-normal"> · {tone.label}</span>
        </p>
        <Button variant="ghost" size="sm" onClick={onOpenIssues} className="h-6 px-2 text-xs">
          <CircleDot className="size-3" aria-hidden="true" />
          Issues
        </Button>
      </div>

      <button
        type="button"
        onClick={onOpenIssues}
        className="focus-visible:ring-ring block w-full rounded-md text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <OpenBar
          icon={CircleDot}
          label="Issues"
          open={work.openIssues}
          resolved={work.closedIssues}
          closedLabel="closed"
          max={max}
          tone="bg-gv-amber"
        />
      </button>

      <button
        type="button"
        onClick={onOpenPullRequests}
        className="focus-visible:ring-ring block w-full rounded-md text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <OpenBar
          icon={GitPullRequest}
          label="Pull requests"
          open={work.openPullRequests}
          resolved={work.mergedPullRequests}
          closedLabel="merged"
          max={max}
          tone="bg-gv-wire"
        />
      </button>
    </div>
  );
}

export { WorkItems, ageTone };
export default memo(WorkItems);