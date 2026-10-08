"use client";

/**
 * Metric strip — four figures on one surface.
 *
 * Built as a single bordered block with `gap-px` over a background fill, which is
 * what produces the hairline dividers. This is the one place on the page where a
 * grid-of-cards pattern is the right answer, and it is borrowed from the
 * `workspace-summary.tsx` it replaces rather than invented: five tiles in a
 * `bg-border grid gap-px` container read as one instrument panel, where five
 * separately rounded cards read as five unrelated widgets competing with each
 * other.
 *
 * Three of the four are clickable and open the section that explains the number;
 * the fourth is not, because there is nowhere to go. A tile that looks clickable
 * and is not is worse than no tile.
 */

import { memo } from "react";
import {
  Boxes,
  GitCommitHorizontal,
  Hash,
  Users,
} from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatCount, formatTokens } from "@/shared/lib/format";
import type { ProjectTab } from "@/features/projects/types/project.types";

export interface MetricStripData {
  totalCommits?: number | null;
  totalContributors?: number | null;
  totalFiles?: number | null;
  estimatedTokens?: number | null;
  chunks?: number | null;
  openItems?: number | null;
}

interface MetricStripProps {
  data: MetricStripData;
  isLoading?: boolean;
  onNavigate?: (tab: ProjectTab) => void;
}

function MetricStrip({ data, isLoading, onNavigate }: MetricStripProps) {
  const tiles = [
    {
      key: "commits",
      label: "Commits",
      value: formatCount(data.totalCommits ?? 0),
      detail: "All time, from GitHub",
      icon: GitCommitHorizontal,
      target: "activity" as ProjectTab,
    },
    {
      key: "contributors",
      label: "Contributors",
      value: formatCount(data.totalContributors ?? 0),
      detail: "All time, reported by GitHub",
      icon: Users,
      target: "team" as ProjectTab,
    },
    {
      key: "open",
      label: "Open items",
      value: formatCount(data.openItems ?? 0),
      detail: "Issues and pull requests",
      icon: Hash,
      target: "issues" as ProjectTab,
    },
    {
      key: "footprint",
      label: "Index footprint",
      value: formatTokens(data.estimatedTokens ?? 0),
      detail:
        (data.chunks ?? 0) > 0
          ? `${formatCount(data.chunks ?? 0)} chunks indexed`
          : "No chunks indexed yet",
      icon: Boxes,
      target: undefined,
    },
  ];

  return (
    <dl
      aria-label="Project metrics"
      className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4"
    >
      {tiles.map(({ key, label, value, detail, icon: Icon, target }) => {
        const body = (
          <>
            <dt className="text-muted-foreground flex items-center justify-between gap-2 text-xs font-medium">
              <span>{label}</span>
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            </dt>
            <dd className="mt-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-14" />
                  <Skeleton className="mt-1.5 h-3 w-20" />
                </>
              ) : (
                <>
                  <span className="text-foreground block truncate text-xl font-semibold tracking-tight tabular-nums">
                    {value}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                    {detail}
                  </span>
                </>
              )}
            </dd>
          </>
        );

        // A non-navigable tile renders as a plain cell so the panel does not
        // advertise five destinations and deliver four.
        return target && onNavigate ? (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(target)}
            className="bg-card hover:bg-muted/40 focus-visible:ring-ring min-w-0 p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          >
            {body}
          </button>
        ) : (
          <div
            key={key}
            className="bg-card min-w-0 p-4"
          >
            {body}
          </div>
        );
      })}
    </dl>
  );
}

export { MetricStrip };
export default memo(MetricStrip);