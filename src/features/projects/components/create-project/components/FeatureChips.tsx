/**
 * =============================================================================
 * FEATURE CHIPS — Developer Spec Sheet
 * =============================================================================
 */

import { GitCommit, RefreshCw, ShieldCheck } from "lucide-react";

const CHIPS = [
  {
    icon: GitCommit,
    text: "Automated Tree & Dependency Mapping",
  },
  {
    icon: RefreshCw,
    text: "Continuous Webhook Sync",
  },
  {
    icon: ShieldCheck,
    text: "Read-only Security Guarantee",
  },
];

export function FeatureChips() {
  return (
    <div>
      <span className="font-gv-mono text-[11px] font-semibold uppercase tracking-wider text-gv-fog">
        Guarantees & Capabilities
      </span>
      <div className="mt-1 flex flex-col">
        {CHIPS.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-2.5 border-b border-gv-hairline/60 py-2.5 font-gv-body text-xs text-gv-fog transition-colors duration-150 last:border-b-0 hover:text-gv-bone"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-gv-amber" />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}