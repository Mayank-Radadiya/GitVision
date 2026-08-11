/**
 * =============================================================================
 * LIVE REPOSITORY PREVIEW & PRESETS PANEL (Signature Moment & Presets)
 * =============================================================================
 *
 * Displays live detected repository details when a valid GitHub URL is provided,
 * quick open-source repository presets for 1-click auto-fill, and analysis scope metadata.
 */

"use client";

import { motion } from "framer-motion";
import {
  GitBranch,
  GitCommit,
  CheckCircle2,
  Sparkles,
  Zap,
  Globe,
  Clock,
  Code2,
} from "lucide-react";
import type { RepoInfo } from "../add-repo.constants";
import { FeatureChips } from "./FeatureChips";
import { cn } from "@/shared/lib/utils";

interface LiveRepoPreviewProps {
  repoInfo: RepoInfo | null;
  repoValid: boolean;
  onSelectPreset: (url: string, name: string) => void;
}

const PRESETS = [
  {
    owner: "facebook",
    repo: "react",
    name: "React Core",
    url: "https://github.com/facebook/react",
  },
  {
    owner: "vercel",
    repo: "next.js",
    name: "Next.js Framework",
    url: "https://github.com/vercel/next.js",
  },
  {
    owner: "tailwindlabs",
    repo: "tailwindcss",
    name: "Tailwind CSS",
    url: "https://github.com/tailwindlabs/tailwindcss",
  },
];

export function LiveRepoPreview({
  repoInfo,
  repoValid,
  onSelectPreset,
}: LiveRepoPreviewProps) {
  return (
    <div className="space-y-5">
      {/* ─── Analysis Target ─────────────────────────────────────────────── */}
      <div className="gv-card p-6">
        <div className="flex items-center justify-between border-b border-gv-hairline/80 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gv-amber" />
            <span className="font-gv-mono text-xs font-semibold uppercase tracking-wider text-gv-bone">
              Analysis Target
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-gv-mono text-[11px]",
              repoValid
                ? "border-gv-moss/25 bg-gv-moss/10 text-gv-moss"
                : "border-gv-hairline bg-gv-graphite-2/50 text-gv-fog",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                repoValid ? "bg-gv-moss animate-pulse" : "bg-gv-fog/50",
              )}
            />
            {repoValid ? "Ready to Index" : "Awaiting Repository"}
          </span>
        </div>

        {repoValid && repoInfo ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 shrink-0 text-gv-wire" />
                  <span className="truncate font-gv-mono text-sm font-bold text-gv-bone">
                    {repoInfo.owner} / {repoInfo.repo}
                  </span>
                </div>
                <p className="mt-1 font-gv-body text-xs text-gv-fog">
                  Public GitHub Repository
                </p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gv-moss/25 bg-gv-moss/10 text-gv-moss">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>

            {/* Estimated analysis metadata */}
            <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-gv-hairline/70 bg-gv-graphite-2/40 p-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-gv-amber" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Default: </span>
                  <span className="font-medium text-gv-bone">main</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-gv-wire" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Est. Time: </span>
                  <span className="font-medium text-gv-bone">~15 sec</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-gv-moss" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Scope: </span>
                  <span className="font-medium text-gv-bone">Full Tree</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-gv-amber" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Cost: </span>
                  <span className="font-medium text-gv-amber">10 Credits</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="mt-5 py-3 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-gv-hairline bg-gv-graphite-2 text-gv-fog/60">
              <GitCommit className="h-5 w-5" />
            </div>
            <p className="mt-3 font-gv-body text-xs leading-relaxed text-gv-fog">
              Enter a GitHub repository URL on the left to resolve tree metadata
              and generate a real-time branch preview.
            </p>
          </div>
        )}
      </div>

      {/* ─── Quick Presets ────────────────────────────────────────────────── */}
      <div className="gv-card p-5">
        <div className="flex items-center justify-between">
          <span className="font-gv-mono text-xs font-semibold uppercase tracking-wider text-gv-fog">
            Quick Try Presets
          </span>
          <span className="font-gv-mono text-[10px] text-gv-fog/70">
            1-click auto-fill
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.url}
              type="button"
              onClick={() => onSelectPreset(preset.url, preset.name)}
              className="group flex w-full cursor-pointer items-center justify-between rounded-lg border border-gv-hairline/80 bg-gv-graphite-2/40 px-3.5 py-2.5 text-left transition-all duration-200 hover:border-gv-amber/30 hover:bg-gv-graphite-2"
            >
              <div className="flex items-center gap-2.5">
                <GitBranch className="h-4 w-4 text-gv-fog transition-colors group-hover:text-gv-amber" />
                <div>
                  <div className="font-gv-mono text-xs font-medium text-gv-bone transition-colors group-hover:text-gv-amber">
                    {preset.owner}/{preset.repo}
                  </div>
                  <div className="font-gv-body text-[11px] text-gv-fog">
                    {preset.name}
                  </div>
                </div>
              </div>
              <span className="font-gv-mono text-[11px] font-medium text-gv-fog/70 transition-colors group-hover:text-gv-amber">
                Fill →
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Feature Badges ───────────────────────────────────────────────── */}
      <div className="gv-card p-4">
        <FeatureChips />
      </div>
    </div>
  );
}