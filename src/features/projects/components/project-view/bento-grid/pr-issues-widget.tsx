"use client";

/**
 * PR & Issues Widget — Tabbed bento card showing Open PRs and Issues.
 * Uses mock data since no live GitHub API is yet connected.
 * Displays a "Connect GitHub" CTA footer.
 */

import { memo } from "react";
import { GitPullRequest, AlertCircle, Clock, Tag, Zap } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_PRS = [
  {
    id: 1,
    title: "feat: Add AI-powered semantic search to code viewer",
    author: "alex_dev",
    avatar:
      "https://ui-avatars.com/api/?name=Alex+Dev&background=6366f1&color=fff",
    label: "feature",
    labelColor: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    age: "2h ago",
    comments: 4,
  },
  {
    id: 2,
    title: "fix: Resolve infinite scroll regression in commit feed",
    author: "priya_k",
    avatar:
      "https://ui-avatars.com/api/?name=Priya+K&background=f59e0b&color=fff",
    label: "bug",
    labelColor: "bg-red-500/15 text-red-400 border-red-500/30",
    age: "5h ago",
    comments: 2,
  },
  {
    id: 3,
    title: "refactor: Extract webhook handlers into modular services",
    author: "marco_t",
    avatar:
      "https://ui-avatars.com/api/?name=Marco+T&background=10b981&color=fff",
    label: "refactor",
    labelColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    age: "1d ago",
    comments: 7,
  },
];

const MOCK_ISSUES = [
  {
    id: 1,
    title: "AI summary takes too long on large commits (>500 files)",
    author: "taylor_r",
    avatar:
      "https://ui-avatars.com/api/?name=Taylor+R&background=3b82f6&color=fff",
    label: "performance",
    labelColor: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    age: "3h ago",
    comments: 6,
  },
  {
    id: 2,
    title: "Code viewer crashes on files with non-UTF-8 encoding",
    author: "sam_j",
    avatar:
      "https://ui-avatars.com/api/?name=Sam+J&background=ef4444&color=fff",
    label: "bug",
    labelColor: "bg-red-500/15 text-red-400 border-red-500/30",
    age: "1h ago",
    comments: 3,
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

interface PRItemProps {
  title: string;
  author: string;
  avatar: string;
  label: string;
  labelColor: string;
  age: string;
  comments: number;
}

function PRItem({
  title,
  author,
  avatar,
  label,
  labelColor,
  age,
  comments,
}: PRItemProps) {
  return (
    <div className="group flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors hover:bg-white/4">
      <Avatar className="ring-border/40 mt-0.5 h-7 w-7 shrink-0 ring-1">
        <AvatarImage src={avatar} alt={author} />
        <AvatarFallback className="text-xs">
          {author[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-foreground group-hover:text-primary line-clamp-2 text-sm leading-snug font-medium transition-colors">
          {title}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`h-4 border px-1.5 py-0 text-[10px] font-medium ${labelColor}`}
          >
            <Tag className="mr-1 h-2.5 w-2.5" />
            {label}
          </Badge>
          <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <Clock className="h-2.5 w-2.5" />
            {age}
          </div>
          {comments > 0 && (
            <span className="text-muted-foreground text-[11px]">
              {comments} comments
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptySlate({ type }: { type: "pr" | "issue" }) {
  const Icon = type === "pr" ? GitPullRequest : AlertCircle;
  const label = type === "pr" ? "pull requests" : "issues";
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="bg-muted/40 border-border/30 mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border">
        <Icon className="text-muted-foreground/50 h-5 w-5" />
      </div>
      <p className="text-muted-foreground text-sm font-medium">
        No open {label}
      </p>
      <p className="text-muted-foreground/60 mt-1 text-xs">
        All caught up — great work! 🎉
      </p>
    </div>
  );
}

// ─── Main Widget ─────────────────────────────────────────────────────────────

function PrIssuesWidget() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
            <GitPullRequest className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-foreground text-sm font-semibold">
            Pull Requests & Issues
          </h3>
        </div>
        <Badge
          variant="outline"
          className="gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] text-amber-400"
        >
          <Zap className="h-2.5 w-2.5" />
          Mock
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prs" className="flex flex-1 flex-col">
        <TabsList className="bg-muted/40 border-border/40 mb-3 h-8 w-full border p-0.5">
          <TabsTrigger
            value="prs"
            className="data-[state=active]:bg-background h-7 flex-1 text-xs data-[state=active]:shadow-sm"
          >
            <GitPullRequest className="mr-1.5 h-3 w-3" />
            Open PRs
            <span className="ml-1.5 rounded-full bg-violet-500/20 px-1.5 py-0 text-[10px] leading-4 font-medium text-violet-400">
              {MOCK_PRS.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="issues"
            className="data-[state=active]:bg-background h-7 flex-1 text-xs data-[state=active]:shadow-sm"
          >
            <AlertCircle className="mr-1.5 h-3 w-3" />
            Issues
            <span className="ml-1.5 rounded-full bg-red-500/20 px-1.5 py-0 text-[10px] leading-4 font-medium text-red-400">
              {MOCK_ISSUES.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prs" className="mt-0 flex-1">
          <ScrollArea className="h-52">
            {MOCK_PRS.length === 0 ? (
              <EmptySlate type="pr" />
            ) : (
              <div className="space-y-1 pr-3">
                {MOCK_PRS.map((pr) => (
                  <PRItem key={pr.id} {...pr} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="issues" className="mt-0 flex-1">
          <ScrollArea className="h-52">
            {MOCK_ISSUES.length === 0 ? (
              <EmptySlate type="issue" />
            ) : (
              <div className="space-y-1 pr-3">
                {MOCK_ISSUES.map((issue) => (
                  <PRItem
                    key={issue.id}
                    title={issue.title}
                    author={issue.author}
                    avatar={issue.avatar}
                    label={issue.label}
                    labelColor={issue.labelColor}
                    age={issue.age}
                    comments={issue.comments}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer CTA */}
      <div className="border-border/30 mt-3 flex items-center justify-between border-t pt-3">
        <p className="text-muted-foreground/60 text-[11px]">
          Live data coming soon
        </p>
        <button className="text-primary hover:text-primary/80 cursor-pointer text-[11px] font-medium transition-colors">
          Connect GitHub →
        </button>
      </div>
    </div>
  );
}

export default memo(PrIssuesWidget);
