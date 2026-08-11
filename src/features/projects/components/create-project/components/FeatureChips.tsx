/**
 * =============================================================================
 * FEATURE CHIPS — Developer Badges
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
    <div className="space-y-2">
      <span className="font-gv-mono text-[11px] font-semibold uppercase tracking-wider text-gv-fog">
        Guarantees & Capabilities
      </span>
      <div className="flex flex-col gap-2">
        {CHIPS.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-2.5 rounded-lg border border-gv-hairline/60 bg-gv-graphite-2/40 px-3 py-2 font-gv-body text-xs text-gv-fog transition-all duration-150 hover:border-gv-amber/30 hover:text-gv-bone"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-gv-amber" />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
