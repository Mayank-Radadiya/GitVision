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
    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
      <div className="relative">
        <div className="bg-primary/10 border-primary/20 flex h-12 w-12 items-center justify-center rounded-2xl border">
          <Sparkles className="text-primary h-5 w-5" />
        </div>
        {/* Pulse ring */}
        <span className="bg-primary/20 absolute inset-0 animate-ping rounded-2xl opacity-75" />
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">AI Triage Ready</p>
        <p className="text-muted-foreground max-w-55 text-xs leading-relaxed">
          Generate an AI summary on any commit to see intelligent insights here.
        </p>
      </div>
      {/* Skeleton bars */}
      <div className="mt-2 w-full space-y-2">
        {[80, 65, 90].map((w, i) => (
          <div
            key={i}
            className="bg-muted/60 h-2 animate-pulse rounded-full"
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary/15 text-primary relative flex h-7 w-7 items-center justify-center rounded-lg">
            <Sparkles className="h-3.5 w-3.5" />
            {hasData && (
              <span className="border-background absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border bg-emerald-500" />
            )}
          </div>
          <h3 className="text-foreground text-sm font-semibold">AI Insights</h3>
        </div>
        <Badge
          variant="outline"
          className="border-primary/30 text-primary bg-primary/10 text-[10px]"
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
          <div className="bg-primary/5 border-primary/15 rounded-xl border p-3.5">
            <p className="text-primary mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase">
              <Sparkles className="h-3 w-3" />
              Quick Summary
            </p>
            <p className="text-foreground/85 line-clamp-4 text-xs leading-relaxed">
              {latestAiSummary}
            </p>
          </div>

          {/* Risk + Complexity */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/30 border-border/30 flex flex-col gap-1.5 rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium tracking-wider uppercase">
                <AlertTriangle className="h-3 w-3" />
                Risk
              </div>
              <Badge
                variant="outline"
                className={`w-fit border text-xs font-semibold ${risk!.color}`}
              >
                {risk!.label}
              </Badge>
            </div>
            <div className="bg-muted/30 border-border/30 flex flex-col gap-1.5 rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium tracking-wider uppercase">
                <Zap className="h-3 w-3" />
                Complexity
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-foreground text-lg font-bold tabular-nums">
                  {complexityScore}
                </span>
                <span className="text-muted-foreground text-xs">/10</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-muted-foreground mb-2 flex items-center gap-1 text-[10px] font-medium tracking-wider uppercase">
              <Tag className="h-2.5 w-2.5" />
              AI-Generated Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-muted/40 border-border/40 text-muted-foreground rounded-md border px-2 py-0.5 text-[11px] font-medium"
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
