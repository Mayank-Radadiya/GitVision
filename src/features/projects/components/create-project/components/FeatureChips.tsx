/**
 * =============================================================================
 * FEATURE CHIPS — GitHub-label-style pills (Brief § Tokens & Aesthetics)
 * =============================================================================
 */

import { GitCommit, Link } from "lucide-react";

const CHIPS = [
  {
    icon: GitCommit,
    text: "Code quality, dependencies, and contributors — mapped automatically.",
  },
  {
    icon: Link,
    text: "Stays in sync with GitHub. No manual re-imports.",
  },
];

export function FeatureChips() {
  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map(({ icon: Icon, text }) => (
        <span
          key={text}
          className="inline-flex items-center gap-2 rounded-full border border-gv-hairline bg-gv-graphite-2 px-3.5 py-1.5 font-gv-body text-[13px] leading-snug text-gv-fog transition-all duration-150 hover:-translate-y-px hover:border-gv-amber/30 hover:text-gv-bone"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-gv-amber" />
          {text}
        </span>
      ))}
    </div>
  );
}
