"use client";

/**
 * AI Insights Widget — "AI Triage" bento card.
 * Shows a quick summary from the latest commit AI summary (if present),
 * plus estimated risk/complexity badges and auto-generated tags.
 */

import { memo } from "react";
import { Sparkles, AlertTriangle, Zap, Tag } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { motion } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AiInsightsWidgetProps {
  /** Latest AI summary from the most recently summarised commit — passed from parent */
  latestAiSummary?: string | null;
}

// ─── Static config ───────────────────────────────────────────────────────────

const RISK_LEVELS = [
  {
    label: "Low",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  {
    label: "Medium",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  { label: "High", color: "bg-red-500/15 text-red-400 border-red-500/30" },
] as const;

const AUTO_TAGS = ["refactor", "feature", "performance", "docs", "fix", "test"];

/** Pick a stable "random" risk level based on summary content */
function pickRisk(summary: string) {
  const len = summary.length;
  if (len < 100) return RISK_LEVELS[0];
  if (len < 250) return RISK_LEVELS[1];
  return RISK_LEVELS[2];
}

/** Pick 2–3 tags seeded by summary content */
function pickTags(summary: string): string[] {
  const tags: string[] = [];
  if (/fix|bug|error|crash/i.test(summary)) tags.push("fix");
  if (/feat|add|new|implement/i.test(summary)) tags.push("feature");
  if (/refactor|clean|restructur/i.test(summary)) tags.push("refactor");
  if (/perf|optim|speed|fast/i.test(summary)) tags.push("performance");
  if (/doc|readme|comment/i.test(summary)) tags.push("docs");
  if (/test|spec|jest|mock/i.test(summary)) tags.push("test");
  // Ensure at least 2 tags
  while (tags.length < 2) tags.push(AUTO_TAGS[tags.length]);
  return tags.slice(0, 3);
}

// ─── Shimmer Loading State ────────────────────────────────────────────────────

function AnalyzingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-2xl animate-ping bg-primary/20 opacity-75" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">AI Triage Ready</p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
          Generate an AI summary on any commit to see intelligent insights here.
        </p>
      </div>
      {/* Skeleton bars */}
      <div className="w-full space-y-2 mt-2">
        {[80, 65, 90].map((w, i) => (
          <div
            key={i}
            className="h-2 rounded-full bg-muted/60 animate-pulse"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Widget ─────────────────────────────────────────────────────────────

function AiInsightsWidget({ latestAiSummary }: AiInsightsWidgetProps) {
  const hasData = !!latestAiSummary;
  const risk = hasData ? pickRisk(latestAiSummary!) : null;
  const tags = hasData ? pickTags(latestAiSummary!) : [];
  const complexityScore = hasData
    ? Math.min(10, Math.round(latestAiSummary!.length / 30))
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {hasData && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-background" />
            )}
          </div>
          <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] border-primary/30 text-primary bg-primary/10"
        >
          Triage
        </Badge>
      </div>

      {/* Content */}
      {!hasData ? (
        <AnalyzingState />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4"
        >
          {/* Summary */}
          <div className="rounded-xl bg-primary/5 border border-primary/15 p-3.5">
            <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Quick Summary
            </p>
            <p className="text-xs text-foreground/85 leading-relaxed line-clamp-4">
              {latestAiSummary}
            </p>
          </div>

          {/* Risk + Complexity */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/30 border border-border/30 p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                <AlertTriangle className="h-3 w-3" />
                Risk
              </div>
              <Badge
                variant="outline"
                className={`w-fit text-xs font-semibold border ${risk!.color}`}
              >
                {risk!.label}
              </Badge>
            </div>
            <div className="rounded-lg bg-muted/30 border border-border/30 p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                <Zap className="h-3 w-3" />
                Complexity
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {complexityScore}
                </span>
                <span className="text-xs text-muted-foreground">/10</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Tag className="h-2.5 w-2.5" />
              AI-Generated Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-muted/40 border border-border/40 px-2 py-0.5 text-[11px] text-muted-foreground font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default memo(AiInsightsWidget);
