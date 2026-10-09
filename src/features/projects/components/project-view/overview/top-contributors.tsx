"use client";

import { memo, useState } from "react";
import { Users } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { formatCount } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

export interface ContributorRowData {
  email: string;
  name: string;
  avatar: string | null;
  commits: number;
}

interface TopContributorsProps {
  contributors: ContributorRowData[];
  /** Commits in the same window across all authors, bots included. */
  totalCommitsInWindow?: number;
  windowLabel?: string;
  isLoading?: boolean;
  /**
   * The insights query failed. Distinct from an empty list, which means the query
   * succeeded and found nobody — "no human commits in this window" is a finding,
   * whereas rendering it after a failure would be a lie about the repository.
   */
  hasFailed?: boolean;
  onOpenTeam?: () => void;
}

/**
 * Mirrors the `LIMIT 12` in the `getInsights` contributor query. Exported so the
 * caption can distinguish "this repo has exactly twelve authors" from "the query
 * stopped at twelve", which is a difference the old caption got wrong.
 */
const CONTRIBUTOR_CAP = 12;

function initials(name: string): string {
  // GitHub hands `authorName` back as anything from "Ada Lovelace" to a
  // `noreply` address, so an email's domain is noise — and splitting on the dot
  // in "example.com" would yield the initials "AC".
  const local = name.includes("@") ? name.slice(0, name.indexOf("@")) : name;
  const parts = local
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function TopContributors({
  contributors,
  windowLabel = "this window",
  totalCommitsInWindow,
  isLoading,
  hasFailed,
  onOpenTeam,
}: TopContributorsProps) {
  const [expanded, setExpanded] = useState(false);
  if (isLoading) {
    return (
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="bg-muted/60 size-7 rounded-full" />
            <div className="bg-muted/30 h-1.5 flex-1 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (hasFailed) {
    return (
      <div
        role="status"
        className="text-muted-foreground flex flex-col items-center justify-center py-6 text-center"
      >
        <p className="text-sm font-medium">Contributors unavailable</p>
        <p className="mt-1 max-w-56 text-xs">
          This rollup is computed server-side, so it could not be read for this
          project right now.
        </p>
      </div>
    );
  }

  if (contributors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Users
          className="text-muted-foreground mb-2 size-5"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">
          {totalCommitsInWindow === 0
            ? "No activity in this period"
            : "No contributor activity"}
        </p>
        <p className="text-muted-foreground mt-1 max-w-56 text-xs">
          No contributor activity was found in {windowLabel}. Bot accounts are
          excluded.
        </p>
      </div>
    );
  }

  const max = contributors[0]!.commits || 1;
  const visible = expanded ? contributors : contributors.slice(0, 5);

  return (
    <div className="space-y-2.5">
      <ol className="space-y-2.5">
        {visible.map((person, index) => (
          <li key={person.email} className="flex items-center gap-2.5">
            <span className="text-muted-foreground w-3 shrink-0 text-right text-[11px] font-semibold tabular-nums">
              {index + 1}
            </span>
            <Avatar className="ring-border/40 size-7 shrink-0 ring-1">
              <AvatarImage src={person.avatar || undefined} alt="" />
              <AvatarFallback className="text-[10px]">
                {initials(person.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="text-foreground min-w-0 flex-1 truncate text-xs font-medium"
                  title={person.name}
                >
                  {person.name}
                </span>
                <span className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
                  {formatCount(person.commits)}
                </span>
              </div>
              <div className="bg-muted/40 mt-1 h-1 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full",
                    index === 0 ? "bg-primary" : "bg-primary/45",
                  )}
                  style={{
                    width: `${Math.max((person.commits / max) * 100, 2)}%`,
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>

      {contributors.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="text-muted-foreground hover:text-foreground w-full rounded py-1 text-left text-[11px] transition-colors"
        >
          {expanded ? "Show fewer" : `Show ${contributors.length - 5} more`}
        </button>
      )}
      <p className="text-muted-foreground border-border flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[10px]">
        <span>
          {/*
            The query is `GROUP BY LOWER(author_email) ... LIMIT 12`, so
            `contributors.length` is a *capped* count, not the number of people
            who committed. Printing "12 authors in this window" is simply false
            for any repo with more than twelve. When the cap is the binding
            constraint the caption says so with a `+`; when the list is short
            enough that no author was dropped, the exact count is safe to state.
          */}
          {contributors.length >= CONTRIBUTOR_CAP
            ? `Top ${visible.length} of ${CONTRIBUTOR_CAP}+ authors`
            : `${contributors.length} author${contributors.length === 1 ? "" : "s"} in ${windowLabel}`}
        </span>
        {onOpenTeam && (
          <button
            type="button"
            onClick={onOpenTeam}
            className="hover:text-foreground focus-visible:ring-ring shrink-0 rounded font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            View contributors
          </button>
        )}
      </p>
    </div>
  );
}

export { TopContributors, initials, CONTRIBUTOR_CAP };
export default memo(TopContributors);
