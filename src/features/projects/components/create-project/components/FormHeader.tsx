/**
 * =============================================================================
 * FORM HEADER — Monospace Display & Technical Voice (Brief § Typography & §5.3)
 * =============================================================================
 */

import { GitBranch } from "lucide-react";

export function FormHeader() {
  return (
    <div className="flex items-start gap-4">
      {/* Graphite icon tile with subtle ember accent border */}
      <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gv-amber/30 bg-gv-graphite-2 shadow-[inset_0_1px_0_rgba(232,163,61,0.15)]">
        <GitBranch className="h-5 w-5 text-gv-amber" />
      </div>
      <div>
        <h1 className="font-gv-mono text-2xl font-bold leading-tight tracking-tight text-gv-bone sm:text-[26px]">
          Add Repository
        </h1>
        <p className="mt-1.5 font-gv-body text-[14px] leading-relaxed text-gv-fog">
          Point GitVision at a repo. We&apos;ll map its structure, dependencies,
          and contributors.
        </p>
      </div>
    </div>
  );
}
