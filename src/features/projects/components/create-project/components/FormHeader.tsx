/**
 * =============================================================================
 * FORM HEADER — Technical Voice & Developer Breadcrumbs
 * =============================================================================
 */

import { GitBranch } from "lucide-react";

export function FormHeader() {
  return (
    <div className="space-y-4">
      {/* Scope Pill Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-gv-amber/30 bg-gv-amber/10 px-3 py-1 font-gv-mono text-[11px] font-medium text-gv-amber">
        <GitBranch className="h-3.5 w-3.5" />
        <span>GitVision Workspace / New Project</span>
      </div>

      <div>
        <h1 className="font-gv-mono text-2xl font-bold tracking-tight text-gv-bone sm:text-3xl">
          Add Repository
        </h1>
        <p className="mt-2 font-gv-body text-sm leading-relaxed text-gv-fog">
          Connect a GitHub repository to analyze code quality, map dependencies,
          and unlock AI-powered codebase vision.
        </p>
      </div>
    </div>
  );
}
