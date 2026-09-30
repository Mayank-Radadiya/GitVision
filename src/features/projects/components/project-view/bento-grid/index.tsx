"use client";

/**
 * Bento Grid v3 — Overview tab layout.
 *
 * Layout (lg):
 *   Row 0: [Repo Briefing (full width)]
 *   Row 1: [Tech Stack (1 col)] | [Contributors (1 col)]
 *   Row 2: [Project Pulse (full width)]
 */

import { memo } from "react";
import type { Commit } from "@/features/projects/types/project.types";
import type { LanguageEntry, RepoBriefing } from "@/db/schema";
import ProjectPulseWidget from "./project-pulse-widget";
import ContributorWidget from "./contributor-widget";
import TechStackWidget from "./tech-stack-widget";
import RepoBriefingCard from "./repo-briefing-card";

// ─── Shared Bento Card Shell ─────────────────────────────────────────────────

export function BentoCard({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-border/40 bg-card/70 hover:border-border/70 relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 hover:shadow-lg hover:shadow-black/8 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/2 via-transparent to-transparent" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface BentoGridProps {
  projectId: string;
  repoUrl: string;
  commits: Commit[];
  totalContributors: number;
  /** Real per-project language breakdown (projects.languages JSONB). */
  languages: LanguageEntry[];
  /** Plain-language briefing (projects.briefing JSONB). Null until generated. */
  briefing: RepoBriefing | null | undefined;
  /** Disambiguates a null briefing: still indexing, or genuinely absent. */
  embeddingStatus: string | null | undefined;
}

// ─── Main export ─────────────────────────────────────────────────────────────

function BentoGrid({
  projectId,
  repoUrl,
  commits,
  totalContributors,
  languages,
  briefing,
  embeddingStatus,
}: BentoGridProps) {
  return (
    <div className="space-y-4">
      {/* Row 0: Repo Briefing — full width, first thing the user reads */}
      <BentoCard>
        <RepoBriefingCard briefing={briefing} embeddingStatus={embeddingStatus} />
      </BentoCard>

      {/* Row 1: Tech Stack (1 col) + Contributors (1 col) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BentoCard>
          <TechStackWidget languages={languages} />
        </BentoCard>

        <BentoCard>
          <ContributorWidget
            commits={commits}
            totalContributors={totalContributors}
          />
        </BentoCard>
      </div>

      {/* Row 2: Project Pulse — full width */}
      <BentoCard>
        <ProjectPulseWidget projectId={projectId} repoUrl={repoUrl} />
      </BentoCard>
    </div>
  );
}

export default memo(BentoGrid);

// Named re-exports for convenience
export { BentoGrid };
