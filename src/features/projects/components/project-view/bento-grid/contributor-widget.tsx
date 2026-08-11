"use client";

/**
 * Contributor Widget v3 — Deduplication by authorEmail (not authorName),
 * with bot-account filtering and avatar facepile + sparkline velocity.
 *
 * Root cause of the "3 contributors" bug:
 *   - Same person commits under different authorName strings ("Mayank-Radadiya", "MAYANK")
 *   - Service accounts like "Vercel" sneak in as contributors
 */

import { memo } from "react";
import { Users } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import type { Commit } from "@/features/projects/types/project.types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContributorWidgetProps {
  commits: Commit[];
  totalContributors: number;
}

interface Contributor {
  name: string;
  email: string;
  avatar?: string | null;
  commitCount: number;
  velocity: number[]; // 7-day sparkline buckets
}

// ─── Bot detection ────────────────────────────────────────────────────────────

const BOT_PATTERNS = [
  /noreply/i,
  /bot@/i,
  /github-actions/i,
  /vercel\b/i,
  /dependabot/i,
  /renovate/i,
  /\[bot\]/i,
];

function isBot(name: string, email: string): boolean {
  const combined = `${name} ${email}`;
  return BOT_PATTERNS.some((re) => re.test(combined));
}

// ─── Aggregation — deduplicate by email ──────────────────────────────────────

function aggregateContributors(commits: Commit[]): Contributor[] {
  const map = new Map<
    string, // key = authorEmail (lowercased)
    { name: string; email: string; avatar?: string | null; commitDates: Date[] }
  >();

  for (const commit of commits) {
    const emailKey = commit.authorEmail.toLowerCase().trim();

    // Skip bots
    if (isBot(commit.authorName, commit.authorEmail)) continue;

    const existing = map.get(emailKey);
    if (existing) {
      existing.commitDates.push(new Date(commit.authorDate));
      // Prefer the longer/more qualified display name
      if (commit.authorName.length > existing.name.length) {
        existing.name = commit.authorName;
      }
    } else {
      map.set(emailKey, {
        name: commit.authorName,
        email: commit.authorEmail,
        avatar: commit.authorAvatar,
        commitDates: [new Date(commit.authorDate)],
      });
    }
  }

  const now = Date.now();
  const DAY = 86_400_000;

  return [...map.values()]
    .map((c) => {
      const vel = Array.from({ length: 7 }, (_, i) => {
        const dayStart = now - (6 - i) * DAY;
        const dayEnd = dayStart + DAY;
        return c.commitDates.filter(
          (d) => d.getTime() >= dayStart && d.getTime() < dayEnd,
        ).length;
      });
      return {
        name: c.name,
        email: c.email,
        avatar: c.avatar,
        commitCount: c.commitDates.length,
        velocity: vel,
      };
    })
    .sort((a, b) => b.commitCount - a.commitCount)
    .slice(0, 5);
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const W = 56;
  const H = 18;
  const step = W / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${H - (v / max) * (H - 2)}`)
    .join(" ");

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-primary/60"
      />
      {data.length > 0 && (
        <circle
          cx={(data.length - 1) * step}
          cy={H - (data[data.length - 1]! / max) * (H - 2)}
          r="2"
          className="fill-primary"
        />
      )}
    </svg>
  );
}

// ─── Facepile ────────────────────────────────────────────────────────────────

function AvatarFacepile({
  contributors,
  totalContributors,
}: {
  contributors: Contributor[];
  totalContributors: number;
}) {
  const humanTotal = Math.max(contributors.length, totalContributors);
  const extra = humanTotal > 5 ? humanTotal - 5 : 0;

  return (
    <div className="mb-4 flex items-center">
      <div className="flex -space-x-2.5">
        {contributors.map((c) => {
          const placeholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random&size=32`;
          return (
            <Avatar
              key={c.email}
              className="ring-background h-8 w-8 ring-2 transition-transform hover:z-10 hover:-translate-y-0.5 hover:scale-110"
            >
              <AvatarImage src={c.avatar || placeholder} alt={c.name} />
              <AvatarFallback className="bg-muted text-[11px]">
                {c.name[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          );
        })}
        {extra > 0 && (
          <div className="ring-background bg-muted text-muted-foreground z-10 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ring-2">
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Contributor Row ─────────────────────────────────────────────────────────

function ContributorRow({
  contributor,
  maxCount,
  rank,
}: {
  contributor: Contributor;
  maxCount: number;
  rank: number;
}) {
  const percentage =
    maxCount > 0 ? (contributor.commitCount / maxCount) * 100 : 0;
  const placeholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(contributor.name)}&background=random&size=32`;

  return (
    <div className="group flex items-center gap-2.5">
      <span className="text-muted-foreground/40 w-3.5 shrink-0 text-right text-[10px] font-bold">
        {rank}
      </span>
      <Avatar className="ring-border/40 group-hover:ring-primary/40 h-6 w-6 shrink-0 ring-1 transition-all">
        <AvatarImage
          src={contributor.avatar || placeholder}
          alt={contributor.name}
        />
        <AvatarFallback className="text-[10px]">
          {contributor.name[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-foreground max-w-22.5 truncate text-xs font-medium">
            {contributor.name}
          </p>
          <div className="ml-1 flex shrink-0 items-center gap-2">
            <Sparkline data={contributor.velocity} />
            <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
              {contributor.commitCount}
            </span>
          </div>
        </div>
        <div className="bg-muted/40 h-1 overflow-hidden rounded-full">
          <div
            className="from-primary/70 to-primary h-full rounded-full bg-linear-to-r transition-all duration-700 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyContributors() {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="bg-muted/40 border-border/30 mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border">
        <Users className="text-muted-foreground/40 h-4 w-4" />
      </div>
      <p className="text-muted-foreground text-xs font-medium">
        No commits yet
      </p>
      <p className="text-muted-foreground/60 mt-0.5 text-[11px]">
        Contributors appear as commits are loaded.
      </p>
    </div>
  );
}

// ─── Main Widget ─────────────────────────────────────────────────────────────

function ContributorWidget({
  commits,
  totalContributors,
}: ContributorWidgetProps) {
  const contributors = aggregateContributors(commits);
  const maxCount = contributors[0]?.commitCount ?? 1;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <Users className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-foreground text-sm leading-none font-semibold">
              Contributors
            </h3>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              7-day velocity
            </p>
          </div>
        </div>
        {contributors.length > 0 && (
          <span className="text-muted-foreground bg-muted/40 border-border/40 rounded-full border px-2 py-0.5 text-[11px]">
            {totalContributors} total
          </span>
        )}
      </div>

      {contributors.length === 0 ? (
        <EmptyContributors />
      ) : (
        <>
          <AvatarFacepile
            contributors={contributors}
            totalContributors={contributors.length}
          />
          <div className="space-y-3">
            {contributors.map((contributor, i) => (
              <ContributorRow
                key={contributor.email}
                contributor={contributor}
                maxCount={maxCount}
                rank={i + 1}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default memo(ContributorWidget);
