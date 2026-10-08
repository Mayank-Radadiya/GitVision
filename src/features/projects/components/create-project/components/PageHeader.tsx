/**
 * PAGE HEADER — Heading & subtext for the create-project form
 */

import { GitBranch, Sparkles } from "lucide-react";

export function PageHeader() {
  return (
    <header className="space-y-3">
      <div className="border-gv-hairline bg-gv-graphite-2/50 font-gv-mono text-gv-fog inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide">
        <GitBranch aria-hidden="true" className="text-gv-amber h-3.5 w-3.5 shrink-0" />
        <span>GitVision</span>
        <span aria-hidden="true" className="text-gv-fog/40">
          /
        </span>
        <span className="text-gv-bone font-semibold">New Project</span>
        <span aria-hidden="true" className="bg-gv-hairline/60 h-2.5 w-px" />
        <span className="text-gv-amber/90 flex items-center gap-1 text-[10px]">
          <Sparkles aria-hidden="true" className="h-2.5 w-2.5" />
          AI Indexing
        </span>
      </div>

      <div>
        <h1 className="font-gv-display text-gv-bone text-3xl font-bold tracking-tight">
          Add a repository
        </h1>
        <p className="font-gv-body text-gv-fog mt-2 text-sm leading-relaxed">
          Connect a public GitHub repo. GitVision indexes the commit history,
          code structure, and embeddings for AI-powered exploration.
        </p>
      </div>
    </header>
  );
}