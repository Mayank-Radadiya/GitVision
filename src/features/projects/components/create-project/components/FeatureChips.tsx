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
      <span className="font-gv-mono text-gv-fog text-[11px] font-semibold tracking-wider uppercase">
        Guarantees & Capabilities
      </span>
      <div className="mt-1 flex flex-col">
        {CHIPS.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="border-gv-hairline/60 font-gv-body text-gv-fog hover:text-gv-bone flex items-center gap-2.5 border-b py-2.5 text-xs transition-colors duration-150 last:border-b-0"
          >
            <Icon className="text-gv-amber h-3.5 w-3.5 shrink-0" />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
