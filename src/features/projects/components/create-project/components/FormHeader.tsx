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
      <div className="border-gv-hairline bg-gv-graphite/50 font-gv-mono text-gv-fog inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide">
        <GitBranch className="text-gv-amber h-3.5 w-3.5" />
        <span>GitVision Workspace</span>
        <span aria-hidden className="text-gv-fog/40">
          /
        </span>
        <span className="text-gv-bone">New Project</span>
      </div>

      <div>
        <h1 className="font-gv-display text-gv-bone text-[28px] leading-[1.12] font-semibold tracking-tight sm:text-[32px]">
          Add a repository
        </h1>
        <p className="font-gv-body text-gv-fog mt-2.5 max-w-[54ch] text-[15px] leading-relaxed">
          Connect a GitHub repository to map its structure, index the codebase,
          and start asking questions in plain language.
        </p>
      </div>
    </header>
  );
}
