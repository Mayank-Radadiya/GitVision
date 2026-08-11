/**
 * =============================================================================
 * FORM HEADER — Display Heading & Workspace Breadcrumb
 * =============================================================================
 */

import { GitBranch } from "lucide-react";

export function FormHeader() {
  return (
    <header className="space-y-5">
      {/* Workspace breadcrumb — amber reserved for the icon */}
      <div className="inline-flex items-center gap-2 rounded-full border border-gv-hairline bg-gv-graphite/50 px-3 py-1 font-gv-mono text-[11px] font-medium tracking-wide text-gv-fog">
        <GitBranch className="h-3.5 w-3.5 text-gv-amber" />
        <span>GitVision Workspace</span>
        <span aria-hidden className="text-gv-fog/40">
          /
        </span>
        <span className="text-gv-bone">New Project</span>
      </div>

      <div>
        <h1 className="font-gv-display text-[28px] font-semibold leading-[1.12] tracking-tight text-gv-bone sm:text-[32px]">
          Add a repository
        </h1>
        <p className="mt-2.5 max-w-[54ch] font-gv-body text-[15px] leading-relaxed text-gv-fog">
          Connect a GitHub repository to map its structure, index the codebase, and
          start asking questions in plain language.
        </p>
      </div>
    </header>
  );
}