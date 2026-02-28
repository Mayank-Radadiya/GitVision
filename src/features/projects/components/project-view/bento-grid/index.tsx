"use client";

/**
 * Bento Grid v3 — Overview tab layout.
 *
 * Layout (lg):
 *   Row 1: [Tech Stack (1 col)] | [Contributors (1 col)]
 *   Row 2: [Project Pulse (full width)]
 */

import { memo } from "react";
import type { Commit } from "@/features/projects/types/project.types";
import ProjectPulseWidget from "./project-pulse-widget";
import ContributorWidget from "./contributor-widget";
import TechStackWidget from "./tech-stack-widget";

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
      className={`relative overflow-hidden rounded-2xl border border-border/40 bg-card/70 backdrop-blur-xl p-5 transition-all duration-300 hover:border-border/70 hover:shadow-lg hover:shadow-black/8 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent" />
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
}

// ─── Main export ─────────────────────────────────────────────────────────────

function BentoGrid({
  projectId,
  repoUrl,
  commits,
  totalContributors,
}: BentoGridProps) {
  return (
    <div className="space-y-4">
      {/* Row 1: Tech Stack (1 col) + Contributors (1 col) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BentoCard>
          <TechStackWidget />
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
