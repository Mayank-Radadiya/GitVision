"use client";

/**
 * AI Triage Board — Open PRs & Issues with AI-generated insight badges.
 * Each item shows: ✨ Risk level, ✨ Area tags, ✨ Estimated effort.
 * Replaces the old pr-issues-widget with a richer, more AI-native UI.
 */

import { memo } from "react";
import {
  GitPullRequest,
  AlertCircle,
  Sparkles,
  Clock,
  ShieldAlert,
  Layers,
  Timer,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AiBadge {
  icon: React.ElementType;
  label: string;
  className: string;
}

interface TriageItem {
  id: number;
  type: "pr" | "issue";
  title: string;
  author: string;
  avatar: string;
  age: string;
  aiBadges: AiBadge[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ITEMS: TriageItem[] = [
  {
    id: 1,
    type: "pr",
    title: "feat: AI semantic search integration with vector embeddings",
    author: "alex_dev",
    avatar:
      "https://ui-avatars.com/api/?name=Alex&background=6366f1&color=fff&size=32",
    age: "2h ago",
    aiBadges: [
      {
        icon: ShieldAlert,
        label: "High Risk",
        className: "bg-red-500/10 text-red-400 border-red-500/25",
      },
      {
        icon: Layers,
        label: "Touches Auth",
        className: "bg-orange-500/10 text-orange-400 border-orange-500/25",
      },
      {
        icon: Timer,
        label: "Est: 5h",
        className: "bg-muted/50 text-muted-foreground border-border/40",
      },
    ],
  },
  {
    id: 2,
    type: "pr",
    title: "fix: Resolve memory leak in commit streaming pipeline",
    author: "priya_k",
    avatar:
      "https://ui-avatars.com/api/?name=Priya&background=f59e0b&color=fff&size=32",
    age: "4h ago",
    aiBadges: [
      {
        icon: ShieldAlert,
        label: "Med Risk",
        className: "bg-amber-500/10 text-amber-400 border-amber-500/25",
      },
      {
        icon: Layers,
        label: "Core Pipeline",
        className: "bg-sky-500/10 text-sky-400 border-sky-500/25",
      },
      {
        icon: Timer,
        label: "Est: 2h",
        className: "bg-muted/50 text-muted-foreground border-border/40",
      },
    ],
  },
  {
    id: 3,
    type: "issue",
    title: "AI summary latency >30s on repos with 500+ contributors",
    author: "taylor_r",
    avatar:
      "https://ui-avatars.com/api/?name=Taylor&background=3b82f6&color=fff&size=32",
    age: "1h ago",
    aiBadges: [
      {
        icon: ShieldAlert,
        label: "High Risk",
        className: "bg-red-500/10 text-red-400 border-red-500/25",
      },
      {
        icon: Layers,
        label: "Performance",
        className: "bg-violet-500/10 text-violet-400 border-violet-500/25",
      },
      {
        icon: Timer,
        label: "Est: 8h",
        className: "bg-muted/50 text-muted-foreground border-border/40",
      },
    ],
  },
  {
    id: 4,
    type: "issue",
    title:
      "Code viewer: syntax highlighting breaks for JSX with TypeScript generics",
    author: "sam_j",
    avatar:
      "https://ui-avatars.com/api/?name=Sam&background=ef4444&color=fff&size=32",
    age: "3h ago",
    aiBadges: [
      {
        icon: ShieldAlert,
        label: "Low Risk",
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
      },
      {
        icon: Layers,
        label: "UI Layer",
        className: "bg-muted/50 text-muted-foreground border-border/40",
      },
      {
        icon: Timer,
        label: "Est: 1h",
        className: "bg-muted/50 text-muted-foreground border-border/40",
      },
    ],
  },
  {
    id: 5,
    type: "pr",
    title: "docs: Update onboarding guide for new embedding workflow",
    author: "marco_t",
    avatar:
      "https://ui-avatars.com/api/?name=Marco&background=10b981&color=fff&size=32",
    age: "6h ago",
    aiBadges: [
      {
        icon: ShieldAlert,
        label: "Low Risk",
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
      },
      {
        icon: Layers,
        label: "Docs",
        className: "bg-muted/50 text-muted-foreground border-border/40",
      },
      {
        icon: Timer,
        label: "Est: 30m",
        className: "bg-muted/50 text-muted-foreground border-border/40",
      },
    ],
  },
];

// ─── Item Row ─────────────────────────────────────────────────────────────────

function TriageRow({ item }: { item: TriageItem }) {
  return (
    <div className="group border-border/40 bg-muted/15 hover:bg-muted/25 hover:border-border/60 cursor-pointer space-y-2.5 rounded-xl border p-3.5 transition-all duration-200">
      {/* Header row */}
      <div className="flex items-start gap-2.5">
        <Avatar className="ring-border/40 mt-0.5 h-7 w-7 shrink-0 ring-1">
          <AvatarImage src={item.avatar} alt={item.author} />
          <AvatarFallback className="text-xs">
            {item.author[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-foreground group-hover:text-primary line-clamp-2 text-xs leading-snug font-medium transition-colors">
            {item.title}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <Clock className="text-muted-foreground/50 h-2.5 w-2.5" />
            <span className="text-muted-foreground/60 text-[10px]">
              {item.age}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-muted-foreground text-[10px]">
              {item.author}
            </span>
          </div>
        </div>
      </div>

      {/* AI Badges */}
      <div className="flex flex-wrap gap-1.5">
        {item.aiBadges.map((badge, i) => {
          const Icon = badge.icon;
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
            >
              <Sparkles className="h-2.5 w-2.5 opacity-90" />
              <Icon className="h-2.5 w-2.5 opacity-70" />
              {badge.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyTriage({ type }: { type: "pr" | "issue" }) {
  const Icon = type === "pr" ? GitPullRequest : AlertCircle;
  const label = type === "pr" ? "pull requests" : "issues";
  return (
    <div className="border-border/40 flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center">
      <div className="bg-muted/40 mb-3 flex h-10 w-10 items-center justify-center rounded-xl">
        <Icon className="text-muted-foreground/30 h-4 w-4" />
      </div>
      <p className="text-muted-foreground text-xs font-medium">
        No open {label}
      </p>
      <p className="text-muted-foreground/50 mt-0.5 text-[11px]">
        All caught up! 🎉
      </p>
    </div>
  );
}

// ─── Main Widget ─────────────────────────────────────────────────────────────

function AiTriageWidget() {
  const prs = MOCK_ITEMS.filter((i) => i.type === "pr");
  const issues = MOCK_ITEMS.filter((i) => i.type === "issue");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-foreground text-sm leading-none font-semibold">
              AI Triage Board
            </h3>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              PRs & Issues · AI-analyzed
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="h-5 border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-400"
        >
          Mock
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prs" className="flex flex-1 flex-col">
        <TabsList className="bg-muted/30 border-border/40 mb-3 h-8 w-full border p-0.5">
          <TabsTrigger
            value="prs"
            className="data-[state=active]:bg-background h-7 flex-1 gap-1.5 text-xs data-[state=active]:shadow-sm"
          >
            <GitPullRequest className="h-3 w-3" />
            PRs
            <span className="rounded-full bg-violet-500/20 px-1.5 text-[9px] leading-4 text-violet-400">
              {prs.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="issues"
            className="data-[state=active]:bg-background h-7 flex-1 gap-1.5 text-xs data-[state=active]:shadow-sm"
          >
            <AlertCircle className="h-3 w-3" />
            Issues
            <span className="rounded-full bg-red-500/20 px-1.5 text-[9px] leading-4 text-red-400">
              {issues.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prs" className="mt-0 flex-1">
          <ScrollArea
            className="h-[calc(100%-0px)]"
            style={{ maxHeight: "400px" }}
          >
            {prs.length === 0 ? (
              <EmptyTriage type="pr" />
            ) : (
              <div className="space-y-2 pr-1">
                {prs.map((item) => (
                  <TriageRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="issues" className="mt-0 flex-1">
          <ScrollArea style={{ maxHeight: "400px" }}>
            {issues.length === 0 ? (
              <EmptyTriage type="issue" />
            ) : (
              <div className="space-y-2 pr-1">
                {issues.map((item) => (
                  <TriageRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="border-border/30 mt-3 flex items-center justify-between border-t pt-3">
        <div className="text-muted-foreground/60 flex items-center gap-1.5 text-[10px]">
          <CheckCircle2 className="h-3 w-3" />
          Live sync coming soon
        </div>
        <button className="text-primary hover:text-primary/80 cursor-pointer text-[11px] font-medium transition-colors">
          Connect GitHub →
        </button>
      </div>
    </div>
  );
}

export default memo(AiTriageWidget);
