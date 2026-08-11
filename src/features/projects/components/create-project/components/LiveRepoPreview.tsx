/**
 * =============================================================================
 * LIVE REPOSITORY PREVIEW & PRESETS PANEL — Linear / Vercel Craftsmanship
 * =============================================================================
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
    key: "1",
    owner: "facebook",
    repo: "react",
    name: "React Core Framework",
    url: "https://github.com/facebook/react",
  },
  {
    key: "2",
    owner: "vercel",
    repo: "next.js",
    name: "Next.js App Router",
    url: "https://github.com/vercel/next.js",
  },
  {
    key: "3",
    owner: "tailwindlabs",
    repo: "tailwindcss",
    name: "Tailwind CSS v4",
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
      {/* ─── Analysis Target Card ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gv-graphite/90 p-6 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_12px_32px_-8px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-gv-amber/40 to-transparent" />

        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
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
                ? "border-gv-moss/30 bg-gv-moss/10 text-gv-moss"
                : "border-white/10 bg-gv-graphite-2/50 text-gv-fog",
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gv-moss/30 bg-gv-moss/10 text-gv-moss">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>

            {/* Analysis Metadata Grid */}
            <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-white/[0.06] bg-gv-graphite-2/60 p-3.5 shadow-inner">
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-gv-amber" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Branch: </span>
                  <span className="font-semibold text-gv-bone">main</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-gv-wire" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Est. Time: </span>
                  <span className="font-semibold text-gv-bone">~15s</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-gv-moss" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Scope: </span>
                  <span className="font-semibold text-gv-bone">Full Tree</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-gv-amber" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Cost: </span>
                  <span className="font-semibold text-gv-amber">10 Credits</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="mt-5 py-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-gv-graphite-2 text-gv-fog/60">
              <GitCommit className="h-5 w-5" />
            </div>
            <p className="mt-3 font-gv-body text-xs leading-relaxed text-gv-fog">
              Enter a GitHub repository URL or click a preset below to resolve tree metadata and preview analysis scope.
            </p>
          </div>
        )}
      </div>

      {/* ─── Quick Presets Card ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-gv-graphite/80 p-5 backdrop-blur-xl shadow-lg">
        <div className="flex items-center justify-between">
          <span className="font-gv-mono text-xs font-semibold uppercase tracking-wider text-gv-fog">
            Quick Try Presets
          </span>
          <span className="font-gv-mono text-[10px] text-gv-fog/70">
            Press [1-3] or Click
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {PRESETS.map((preset) => {
            const isSelected =
              repoInfo?.owner.toLowerCase() === preset.owner.toLowerCase() &&
              repoInfo?.repo.toLowerCase() === preset.repo.toLowerCase();

            return (
              <button
                key={preset.url}
                type="button"
                onClick={() => onSelectPreset(preset.url, preset.name)}
                className={cn(
                  "group flex w-full cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200",
                  isSelected
                    ? "border-gv-amber/50 bg-gv-amber/10 shadow-[0_0_12px_rgba(232,163,61,0.15)]"
                    : "border-white/[0.06] bg-gv-graphite-2/50 hover:border-gv-amber/30 hover:bg-gv-graphite-2",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded border border-white/10 bg-white/5 font-gv-mono text-[10px] font-bold text-gv-fog group-hover:border-gv-amber/40 group-hover:text-gv-amber">
                    {preset.key}
                  </span>
                  <div>
                    <div
                      className={cn(
                        "font-gv-mono text-xs font-semibold transition-colors",
                        isSelected
                          ? "text-gv-amber"
                          : "text-gv-bone group-hover:text-gv-amber",
                      )}
                    >
                      {preset.owner}/{preset.repo}
                    </div>
                    <div className="font-gv-body text-[11px] text-gv-fog">
                      {preset.name}
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "font-gv-mono text-[11px] font-medium transition-colors",
                    isSelected
                      ? "text-gv-amber font-bold"
                      : "text-gv-fog/70 group-hover:text-gv-amber",
                  )}
                >
                  {isSelected ? "Selected" : "Fill →"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Security & Capability Badges ─────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.08] bg-gv-graphite/60 p-4 backdrop-blur-xl">
        <FeatureChips />
      </div>
    </div>
  );
}