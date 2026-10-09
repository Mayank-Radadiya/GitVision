"use client";

import { memo, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronDown,
  ExternalLink,
  GitCommitHorizontal,
  Loader2,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { Button } from "@/shared/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import {
  useProjectCommits,
  useGenerateAiSummary,
} from "@/features/projects/hooks/use-project";
import type { Commit } from "@/features/projects/types/project.types";
import {
  EmptyState,
  InlineError,
  ListSkeleton,
  ListToolbar,
  SectionHeading,
} from "../workspace-ui";
import { initials } from "../overview/top-contributors";

function CommitRow({
  commit,
  repoUrl,
  generating,
  busy,
  onGenerate,
}: {
  commit: Commit;
  repoUrl?: string;
  generating: boolean;
  busy: boolean;
  onGenerate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `commit-panel-${commit.id}`;
  const [subject, ...body] = commit.commitMessage.split("\n");
  return (
    <article className="group hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
        <Avatar className="mt-0.5 size-8 shrink-0">
          <AvatarImage src={commit.authorAvatar || undefined} alt="" />
          <AvatarFallback className="text-xs">
            {initials(commit.authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-start justify-between gap-3 rounded-sm text-left text-sm leading-relaxed font-medium"
          >
            <span className="min-w-0 break-words">
              {subject || "Untitled commit"}
            </span>
            <ChevronDown
              className={`text-muted-foreground mt-1 size-4 shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>{commit.authorName}</span>
            <time dateTime={new Date(commit.authorDate).toISOString()}>
              {formatDistanceToNow(new Date(commit.authorDate), {
                addSuffix: true,
              })}
            </time>
            {repoUrl ? (
              <a
                href={`${repoUrl.replace(/\.git$/, "")}/commit/${commit.commitHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary inline-flex items-center gap-1.5 rounded-sm font-mono transition-colors"
                aria-label={`View commit ${commit.commitHash.slice(0, 7)} on GitHub`}
              >
                {commit.commitHash.slice(0, 7)}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : (
              <code>{commit.commitHash.slice(0, 7)}</code>
            )}
            {commit.aiSummary && (
              <span className="text-primary inline-flex items-center gap-1">
                <Sparkles className="size-3" />
                Analysis available
              </span>
            )}
          </div>
        </div>
      </div>
      {expanded && (
        <div
          id={panelId}
          className="border-border/60 bg-muted/15 space-y-4 border-t px-4 py-5 sm:px-5"
        >
          {body.join("\n").trim() && (
            <pre className="border-border bg-background rounded-lg border p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
              {body.join("\n").trim()}
            </pre>
          )}
          {generating ? (
            <p
              role="status"
              className="text-muted-foreground flex items-center gap-2 text-sm"
            >
              <Loader2 className="size-4 animate-spin" />
              Analyzing this commit…
            </p>
          ) : commit.aiSummary ? (
            <div>
              <p className="text-primary mb-2 flex items-center gap-2 text-xs font-medium">
                <Sparkles className="size-3.5" />
                AI analysis
              </p>
              <p className="text-sm leading-7 break-words whitespace-pre-wrap">
                {commit.aiSummary}
              </p>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onGenerate(commit.id)}
            >
              <Sparkles className="size-3.5" />
              Generate AI analysis
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function CommitsTab({ repoUrl }: { repoUrl?: string } = {}) {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useProjectCommits(projectId);
  const summary = useGenerateAiSummary(projectId);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [generating, setGenerating] = useState<string | null>(null);
  const commits = useMemo(
    () => data?.pages.flatMap((page) => page.commits) ?? [],
    [data],
  );
  const visible = useMemo(
    () =>
      commits
        .filter((commit) =>
          `${commit.commitMessage} ${commit.authorName} ${commit.commitHash}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .sort(
          (a, b) =>
            (new Date(b.authorDate).getTime() -
              new Date(a.authorDate).getTime()) *
            (sort === "newest" ? 1 : -1),
        ),
    [commits, search, sort],
  );
  const generate = (commitId: string) => {
    setGenerating(commitId);
    summary.mutate(
      { projectId, commitId },
      {
        onSettled: () => setGenerating(null),
        onSuccess: () => toast.success("Commit analysis ready"),
        onError: (error) =>
          toast.error(error.message || "Couldn’t analyze this commit"),
      },
    );
  };
  return (
    <div className="space-y-5">
      <SectionHeading
        title="Commit history"
        description="Explore changes and understand the decisions behind them."
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        label="Search commits"
        placeholder="Search message, author, or hash…"
      >
        <select
          aria-label="Sort commits"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </ListToolbar>
      {isError && (
        <InlineError
          message="Couldn’t load commit history."
          onRetry={() => void refetch()}
          pending={isFetching}
        />
      )}
      <div className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
        {isLoading ? (
          <ListSkeleton />
        ) : commits.length === 0 ? (
          !isError && (
            <EmptyState
              title="No commits tracked"
              description="Commit history will appear here after it has been synced from GitHub."
            />
          )
        ) : visible.length === 0 ? (
          <EmptyState
            title="No matching commits"
            description="Try another message, author, or hash."
            action={
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          visible.map((commit) => (
            <CommitRow
              key={commit.id}
              commit={commit}
              repoUrl={repoUrl}
              generating={generating === commit.id}
              busy={generating !== null}
              onGenerate={generate}
            />
          ))
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {commits.length} loaded · search and sorting apply to loaded history.
        </p>
        {hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <GitCommitHorizontal className="size-3.5" />
            )}
            {isFetchingNextPage ? "Loading…" : "Load older commits"}
          </Button>
        )}
      </div>
    </div>
  );
}
export default memo(CommitsTab);
