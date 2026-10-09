"use client";

import { memo } from "react";
import {
  CircleDot,
  GitPullRequest,
  Inbox,
  ArrowRight,
  Clock3,
} from "lucide-react";
import { formatCount } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { SegmentedBar, type Segment } from "../charts/segmented-bar";

export interface OpenAgeBuckets {
  fresh: number;
  aging: number;
  stale: number;
  dormant: number;
}

export interface WorkSummary {
  openIssues: number;
  closedIssues: number;
  openPullRequests: number;
  mergedPullRequests: number;
  medianOpenAgeDays: number | null;
  /**
   * Optional because a `WorkSummary` is also built by callers that only have the
   * scalar counts. When absent, the distribution is omitted and the bands stay
   * the whole of the ageing story — never a fabricated zero-filled histogram.
   */
  openAgeBuckets?: OpenAgeBuckets;
}

interface AgeBand {
  key: keyof OpenAgeBuckets;
  label: string;
  barClassName: string;
  /** Legend dot. Stated separately rather than derived from `barClassName`,
   *  so the ramp's alpha step stays readable in the token table. */
  dotClassName: string;
  textClassName: string;
}

/**
 * Two greens before the amber, not one. `fresh` and `aging` are the same
 * judgement with different urgency, so they share a hue and separate on
 * saturation — which keeps the eye on the ramp's *direction* (healthy → not)
 * instead of on four unrelated colours.
 */
const AGE_BANDS: AgeBand[] = [
  {
    key: "fresh",
    label: "≤ 7d",
    barClassName: "bg-gv-moss",
    dotClassName: "bg-gv-moss",
    textClassName: "text-gv-moss",
  },
  {
    key: "aging",
    label: "8–30d",
    barClassName: "bg-gv-moss/55",
    dotClassName: "bg-gv-moss/60",
    textClassName: "text-gv-moss",
  },
  {
    key: "stale",
    label: "31–90d",
    barClassName: "bg-gv-amber",
    dotClassName: "bg-gv-amber",
    textClassName: "text-gv-amber",
  },
  {
    key: "dormant",
    label: "> 90d",
    barClassName: "bg-gv-ember",
    dotClassName: "bg-gv-ember",
    textClassName: "text-gv-ember",
  },
];

export interface AgeLegendEntry {
  key: keyof OpenAgeBuckets;
  label: string;
  value: number;
  dotClassName: string;
  textClassName: string;
}

export interface AgeDistribution {
  segments: Segment[];
  legend: AgeLegendEntry[];
  total: number;
  /** The oldest occupied band after the first week, or null. */
  worst: AgeBand | null;
  /** Plain-language summary of the oldest occupied band. */
  worstSentence: string | null;
}

function sumBuckets(buckets: OpenAgeBuckets): number {
  return buckets.fresh + buckets.aging + buckets.stale + buckets.dormant;
}

/**
 * Turn the bucket counts into renderable bands, or `null` when they should not
 * be drawn at all.
 *
 * Returns `null` in three cases, each of which would otherwise render a
 * confident-looking bar built on numbers that do not support it:
 *
 *   - no buckets at all (older caller shape) — omit rather than draw four zeros
 *   - nothing open — there is no distribution to show
 *   - **the buckets do not sum to the open-item total.** This is the one that
 *     matters. The counts come from a single `SUM(...) FILTER (WHERE state='open')`
 *     today, so they agree by construction; the guard exists so that if a future
 *     edit splits them across statements or snapshot drift separates them, the
 *     page degrades to the two bars instead of drawing a histogram whose bands
 *     silently fail to add up to the number printed right above them.
 */
export function describeAgeDistribution(
  buckets: OpenAgeBuckets | null | undefined,
  openTotal: number,
): AgeDistribution | null {
  if (!buckets || openTotal <= 0) return null;

  const total = sumBuckets(buckets);
  if (total <= 0 || total !== openTotal) return null;

  const entries = AGE_BANDS.map((band) => ({
    band,
    value: Math.max(buckets[band.key] ?? 0, 0),
  }));

  // The "worst" band is simply the oldest band that holds anything, searched from
  // the stale end. `fresh` is excluded because it is not a finding: a backlog where
  // everything is under a week old is the healthy outcome, and naming it the worst
  // band would describe a well-kept project as a problem. Null in that case, which
  // the caption reads as "nothing has been sitting".
  //
  // Two earlier versions got this wrong in the same direction. Searching `entries`
  // forward from `fresh` reported the best band as the worst. Then requiring the
  // band to hold a third of the backlog fixed nothing, because a forward search can
  // only match a band younger than the first one — with 9 of 10 fresh it still
  // matched `fresh`. The threshold was redundant: searching oldest-first already
  // prefers the most stale band, so age alone decides.
  const worstEntry = [...entries]
    .reverse()
    .find((entry) => entry.value > 0 && entry.band.key !== "fresh");

  return {
    segments: entries.map(({ band, value }) => ({
      key: band.key,
      value,
      className: band.barClassName,
    })),
    legend: entries.map(({ band, value }) => ({
      key: band.key,
      label: band.label,
      value,
      dotClassName: band.dotClassName,
      textClassName: band.textClassName,
    })),
    total,
    worst: worstEntry?.band ?? null,
    worstSentence: worstEntry
      ? worstEntry.value === 1
        ? `1 open item ${worstEntry.band.key === "dormant" ? "has been open over 90 days" : `is ${worstEntry.band.label} old`}`
        : `${formatCount(worstEntry.value)} open items are ${worstEntry.band.label} old`
      : null,
  };
}

/**
 * Age thresholds. `describeIndexHealth`'s sibling judgement in the same file
 * tree, and the reason the bands above reuse these boundaries — the caption and
 * the histogram must not disagree about which day makes an item stale.
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
  if (days <= 90) return { label: "Ageing", className: "text-gv-amber" };
  return { label: "Stale", className: "text-gv-ember" };
}

interface WorkItemsProps {
  work?: WorkSummary;
  isLoading?: boolean;
  /**
   * The aggregate failed rather than returning nothing. Without this, an absent
   * `work` object is indistinguishable from a repository that genuinely has no
   * open items, and the reader would be told "Nothing open" when the truth is
   * "not asked".
   */
  hasFailed?: boolean;
  onOpenIssues?: () => void;
  onOpenPullRequests?: () => void;
}

function WorkItems({
  work,
  isLoading,
  hasFailed,
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
        <div className="bg-muted/30 mt-2 h-2 w-full rounded-full" />
        <div className="bg-muted/20 h-3 w-40 rounded" />
      </div>
    );
  }

  if (hasFailed) {
    return (
      <p
        role="status"
        className="text-muted-foreground bg-muted/30 rounded-md px-3 py-6 text-center text-xs"
      >
        Work-item counts couldn’t be loaded.
      </p>
    );
  }

  if (!work)
    return (
      <p className="text-muted-foreground py-6 text-xs">
        Work data is unavailable.
      </p>
    );
  const openTotal = work.openIssues + work.openPullRequests;
  const distribution = describeAgeDistribution(work.openAgeBuckets, openTotal);
  const olderWork = distribution
    ? (work.openAgeBuckets?.stale ?? 0) + (work.openAgeBuckets?.dormant ?? 0)
    : null;

  return (
    <div>
      {openTotal === 0 ? (
        <div className="bg-muted/25 mb-4 flex items-center gap-3 rounded-md px-4 py-5">
          <Inbox
            className="text-muted-foreground size-5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium">No open work</p>
            <p className="text-muted-foreground mt-1 text-xs">
              No open issues or pull requests in the synced history.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p
              className={cn(
                "flex items-center gap-2 text-xs",
                olderWork && olderWork > 0
                  ? "text-gv-amber"
                  : "text-muted-foreground",
              )}
            >
              <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
              {olderWork === null
                ? `${formatCount(openTotal)} items currently open`
                : olderWork > 0
                  ? `${formatCount(olderWork)} ${olderWork === 1 ? "item has" : "items have"} been open for more than 30 days`
                  : "All open work is 30 days old or newer"}
            </p>
            <p className="text-muted-foreground text-[11px] tabular-nums">
              Median age{" "}
              <span className="text-foreground font-medium">
                {work.medianOpenAgeDays == null
                  ? "—"
                  : `${work.medianOpenAgeDays}d`}
              </span>
            </p>
          </div>
          {distribution && (
            <>
              <SegmentedBar
                segments={distribution.segments}
                total={distribution.total}
                ariaLabel={`Age of ${formatCount(distribution.total)} open items: ${distribution.legend.map((entry) => `${entry.value} ${entry.label}`).join(", ")}`}
                barClassName="h-2"
              />
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {distribution.legend.map((entry) => (
                  <li
                    key={entry.key}
                    className="text-muted-foreground flex items-center gap-1.5 text-[11px] tabular-nums"
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        entry.dotClassName,
                      )}
                      aria-hidden="true"
                    />
                    <span>{entry.label}</span>
                    <span className="text-foreground ml-auto font-medium">
                      {formatCount(entry.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <div className="mt-5 grid gap-2">
        {[
          {
            label: "Issues",
            count: work.openIssues,
            resolved: work.closedIssues,
            onClick: onOpenIssues,
            Icon: CircleDot,
          },
          {
            label: "Pull requests",
            count: work.openPullRequests,
            resolved: work.mergedPullRequests,
            onClick: onOpenPullRequests,
            Icon: GitPullRequest,
          },
        ].map(({ label, count, resolved, onClick, Icon }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className="group border-border hover:bg-muted/40 flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors disabled:cursor-default disabled:hover:bg-transparent"
          >
            <Icon
              className="text-muted-foreground size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="flex-1 text-xs font-medium">
              {label}
              <span className="text-muted-foreground mt-0.5 block text-[10px] font-normal">
                {formatCount(count)} open · {formatCount(resolved)} closed
              </span>
            </span>
            {onClick && (
              <ArrowRight
                className="text-muted-foreground size-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export { WorkItems, ageTone, AGE_BANDS };
export default memo(WorkItems);
