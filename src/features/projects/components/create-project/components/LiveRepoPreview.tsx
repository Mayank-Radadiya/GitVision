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
import { type RepoInfo, PRESETS } from "../add-repo.constants";
import { FeatureChips } from "./FeatureChips";
import { cn } from "@/shared/lib/utils";

interface LiveRepoPreviewProps {
  repoInfo: RepoInfo | null;
  repoValid: boolean;
  onSelectPreset: (url: string, name: string) => void;
}

export function LiveRepoPreview({
  repoInfo,
  repoValid,
  onSelectPreset,
}: LiveRepoPreviewProps) {
  return (
    <div className="space-y-5">
      {/* ─── Analysis Target Card ────────────────────────────────────────── */}
      <div className="bg-gv-graphite/90 relative overflow-hidden rounded-2xl border border-white/8 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_12px_32px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="via-gv-amber/40 absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-transparent to-transparent" />

        <div className="flex items-center justify-between border-b border-white/6 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-gv-amber h-4 w-4" />
            <span className="font-gv-mono text-gv-bone text-xs font-semibold tracking-wider uppercase">
              Analysis Target
            </span>
          </div>
          <span
            className={cn(
              "font-gv-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px]",
              repoValid
                ? "border-gv-moss/30 bg-gv-moss/10 text-gv-moss"
                : "bg-gv-graphite-2/50 text-gv-fog border-white/10",
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
                  <Globe className="text-gv-wire h-4 w-4 shrink-0" />
                  <span className="font-gv-mono text-gv-bone truncate text-sm font-bold">
                    {repoInfo.owner} / {repoInfo.repo}
                  </span>
                </div>
                <p className="font-gv-body text-gv-fog mt-1 text-xs">
                  Public GitHub Repository
                </p>
              </div>
              <div className="border-gv-moss/30 bg-gv-moss/10 text-gv-moss flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>

            {/* Analysis Metadata Grid */}
            <div className="bg-gv-graphite-2/60 grid grid-cols-2 gap-2.5 rounded-xl border border-white/6 p-3.5 shadow-inner">
              <div className="flex items-center gap-2">
                <GitBranch className="text-gv-amber h-3.5 w-3.5" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Branch: </span>
                  <span className="text-gv-bone font-semibold">main</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="text-gv-wire h-3.5 w-3.5" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Est. Time: </span>
                  <span className="text-gv-bone font-semibold">~15s</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Code2 className="text-gv-moss h-3.5 w-3.5" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Scope: </span>
                  <span className="text-gv-bone font-semibold">Full Tree</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="text-gv-amber h-3.5 w-3.5" />
                <div className="font-gv-mono text-xs">
                  <span className="text-gv-fog">Cost: </span>
                  <span className="text-gv-amber font-semibold">
                    10 Credits
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="mt-5 py-4 text-center">
            <div className="bg-gv-graphite-2 text-gv-fog/60 mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/8">
              <GitCommit className="h-5 w-5" />
            </div>
            <p className="font-gv-body text-gv-fog mt-3 text-xs leading-relaxed">
              Enter a GitHub repository URL or click a preset below to resolve
              tree metadata and preview analysis scope.
            </p>
          </div>
        )}
      </div>

      {/* ─── Quick Presets Card ───────────────────────────────────────────── */}
      <div className="bg-gv-graphite/80 rounded-2xl border border-white/8 p-5 shadow-lg backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="font-gv-mono text-gv-fog text-xs font-semibold tracking-wider uppercase">
            Quick Try Presets
          </span>
          <span className="font-gv-mono text-gv-fog/70 text-[10px]">
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
                    : "bg-gv-graphite-2/50 hover:border-gv-amber/30 hover:bg-gv-graphite-2 border-white/6",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-gv-mono text-gv-fog group-hover:border-gv-amber/40 group-hover:text-gv-amber flex h-5 w-5 items-center justify-center rounded border border-white/10 bg-white/5 text-[10px] font-bold">
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
                    <div className="font-gv-body text-gv-fog text-[11px]">
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
      <div className="bg-gv-graphite/60 rounded-2xl border border-white/8 p-4 backdrop-blur-xl">
        <FeatureChips />
      </div>
    </div>
  );
}
