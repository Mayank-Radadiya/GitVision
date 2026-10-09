"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  CircleDot,
  CircleCheck,
  ExternalLink,
  GitPullRequest,
  MessageSquare,
  RefreshCw,
  Loader2,
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
  usePaginatedProjectIssues,
  useIssueComments,
  useSyncIssues,
} from "@/features/projects/hooks/use-project";
import { cn } from "@/shared/lib/utils";
import {
  EmptyState,
  InlineError,
  ListSkeleton,
  ListToolbar,
  ProjectStatus,
  SectionHeading,
} from "../workspace-ui";

type WorkItem = NonNullable<
  ReturnType<typeof usePaginatedProjectIssues>["data"]
>["pages"][number]["items"][number];

function IssueDiscussion({
  issueId,
  githubUrl,
}: {
  issueId: string;
  githubUrl?: string;
}) {
  const { data, isLoading, isError, isFetching, refetch } =
    useIssueComments(issueId);
  return (
    <div className="border-border bg-muted/15 space-y-4 border-t px-4 py-5 sm:px-5">
      <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        <MessageSquare className="size-3.5" />
        Discussion
      </p>
      {isError && (
        <InlineError
          message="Couldn’t load this discussion."
          onRetry={() => void refetch()}
          pending={isFetching}
        />
      )}
      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : data?.comments.length ? (
        <ol className="space-y-5">
          {data.comments.map((comment) => (
            <li key={comment.id} className="flex items-start gap-3">
              <Avatar className="size-7 shrink-0">
                <AvatarImage src={comment.authorAvatar || undefined} alt="" />
                <AvatarFallback className="text-xs">
                  {comment.authorLogin.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-medium">{comment.authorLogin}</span>
                  <time
                    className="text-muted-foreground"
                    dateTime={new Date(comment.githubCreatedAt).toISOString()}
                  >
                    {formatDistanceToNow(new Date(comment.githubCreatedAt), {
                      addSuffix: true,
                    })}
                  </time>
                </div>
                <p className="mt-2 text-sm leading-7 break-words whitespace-pre-wrap">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        !isError && (
          <p className="text-muted-foreground text-sm">
            No comments in the synced discussion yet.
          </p>
        )
      )}
      {data?.hasMore && githubUrl && (
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-2 text-xs font-medium"
        >
          Read the full discussion on GitHub
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}

function WorkRow({
  item,
  repoUrl,
  isPullRequest,
}: {
  item: WorkItem;
  repoUrl?: string;
  isPullRequest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `work-discussion-${item.id}`;
  const githubUrl = repoUrl
    ? `${repoUrl.replace(/\.git$/, "")}/${isPullRequest ? "pull" : "issues"}/${item.issueNumber}`
    : undefined;
  const Icon = isPullRequest
    ? GitPullRequest
    : item.state === "open"
      ? CircleDot
      : CircleCheck;
  const date = item.githubUpdatedAt ?? item.githubCreatedAt;
  return (
    <article className="hover:bg-muted/25 transition-colors">
      <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
        <Icon
          className={cn(
            "mt-1 size-4 shrink-0",
            item.state === "open" ? "text-gv-moss" : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpanded((value) => !value)}
              className="flex min-w-0 flex-1 items-start gap-2 rounded-sm text-left text-sm leading-relaxed font-medium"
            >
              <span className="min-w-0 break-words">{item.title}</span>
              <ChevronDown
                className={`text-muted-foreground mt-1 size-3.5 shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            <ProjectStatus tone={item.state === "open" ? "success" : "neutral"}>
              {item.state === "open" ? "Open" : "Closed"}
            </ProjectStatus>
          </div>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-mono">#{item.issueNumber}</span>
            <span>{item.authorLogin}</span>
            {date && (
              <time dateTime={new Date(date).toISOString()}>
                Updated{" "}
                {formatDistanceToNow(new Date(date), { addSuffix: true })}
              </time>
            )}
            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${isPullRequest ? "pull request" : "issue"} ${item.issueNumber} on GitHub`}
                className="hover:text-primary inline-flex items-center gap-1.5 rounded-sm transition-colors"
              >
                GitHub
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
      {expanded && (
        <div id={panelId}>
          <IssueDiscussion issueId={item.id} githubUrl={githubUrl} />
        </div>
      )}
    </article>
  );
}

export default function RepositoryWorkList({
  projectId,
  repoUrl,
  isPullRequest,
}: {
  projectId: string;
  repoUrl?: string;
  isPullRequest: boolean;
}) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = usePaginatedProjectIssues(projectId, isPullRequest);
  const sync = useSyncIssues(projectId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("updated");
  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const visible = useMemo(
    () =>
      items
        .filter(
          (item) =>
            `${item.title} ${item.issueNumber} ${item.authorLogin}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()) &&
            (filter === "All" || item.state === filter.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "number"
            ? b.issueNumber - a.issueNumber
            : new Date(b.githubUpdatedAt ?? b.githubCreatedAt ?? 0).getTime() -
              new Date(a.githubUpdatedAt ?? a.githubCreatedAt ?? 0).getTime(),
        ),
    [items, search, filter, sort],
  );
  const label = isPullRequest ? "pull requests" : "issues";
  const syncWork = () =>
    sync.mutate(
      { projectId },
      {
        onSuccess: () => toast.success("Issues and pull requests synced"),
        onError: (error) =>
          toast.error(error.message || "Couldn’t sync repository work"),
      },
    );
  return (
    <div className="space-y-5">
      <SectionHeading
        title={isPullRequest ? "Pull requests" : "Issues"}
        description={
          isPullRequest
            ? "Follow proposed changes and the discussion behind them."
            : "Track repository work and follow the discussion."
        }
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={syncWork}
            disabled={sync.isPending}
          >
            {sync.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {sync.isPending ? "Syncing…" : "Sync from GitHub"}
          </Button>
        }
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        label={`Search ${label}`}
        placeholder={`Search ${label}…`}
      >
        <select
          aria-label="Sort repository work"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">Recently updated</option>
          <option value="number">Newest number</option>
        </select>
        <div
          role="group"
          aria-label={`Filter ${label} by status`}
          className="border-border bg-muted/40 flex rounded-md border p-0.5"
        >
          {["All", "Open", "Closed"].map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                filter === value
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </ListToolbar>
      {isError && (
        <InlineError
          message={`Couldn’t load ${label}.`}
          onRetry={() => void refetch()}
          pending={isFetching}
        />
      )}
      <div className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border">
        {isLoading ? (
          <ListSkeleton />
        ) : items.length === 0 && !isError ? (
          <EmptyState
            title={`No ${label} synced`}
            description={`Sync from GitHub to check for repository ${label}.`}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={syncWork}
                disabled={sync.isPending}
              >
                {sync.isPending ? "Syncing…" : "Sync from GitHub"}
              </Button>
            }
          />
        ) : visible.length === 0 && items.length > 0 ? (
          <EmptyState
            title={`No matching ${label}`}
            description="Try another search or status filter."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFilter("All");
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          visible.map((item) => (
            <WorkRow
              key={item.id}
              item={item}
              repoUrl={repoUrl}
              isPullRequest={isPullRequest}
            />
          ))
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {items.length} loaded · search, filters, and sorting apply to loaded
          results.
        </p>
        {hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </div>
  );
}
