"use client";

import { memo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  Code2,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  Loader2,
  PanelRight,
  Search,
  Github,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import { IndexingStatusBadge } from "./indexing-status-badge";
import EditableProjectName from "./editable-project-name";
import { formatRelativeShort } from "@/shared/lib/format";
import { useNow } from "./overview/use-now";
import { OPEN_COMMAND_EVENT } from "./workspace-navigation";
import { useProjectActions } from "./project-actions";

export function ProjectOptionsDropdown() {
  const actions = useProjectActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Project actions menu"
          className="text-muted-foreground size-9"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="project-workspace w-48">
        <DropdownMenuItem
          onSelect={actions.syncProject}
          disabled={actions.syncing || actions.deleting}
        >
          {actions.syncing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {actions.syncing ? "Queueing sync…" : "Sync files"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={actions.requestDelete}
          disabled={actions.deleting || actions.syncing}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4" />
          Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ProjectHeaderProps {
  projectName?: string;
  githubUrl?: string;
  isLoading: boolean;
  projectId: string;
  onOpenCodeViewer: () => void;
  onOpenDetails: () => void;
  embeddingStatus?: string | null;
  totalFiles?: number | null;
  indexedFileCount?: number | null;
  totalFileCount?: number | null;
  lastSyncedAt?: Date | string | null;
}

function ProjectHeader({
  projectName,
  githubUrl,
  isLoading,
  projectId,
  onOpenCodeViewer,
  onOpenDetails,
  embeddingStatus,
  totalFiles,
  indexedFileCount,
  totalFileCount,
  lastSyncedAt,
}: ProjectHeaderProps) {
  const now = useNow();
  const actions = useProjectActions();
  return (
    <header className="bg-background">
      <div className="mx-auto max-w-[1280px] px-4 pt-4 pb-6 md:px-8">
        <div className="mb-6 flex h-9 items-center justify-between gap-3 pl-12 md:pl-0">
          <nav
            aria-label="Breadcrumb"
            className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs"
          >
            <Link
              href="/dashboard"
              className="hover:text-foreground transition-colors"
            >
              Projects
            </Link>
            <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            <span aria-current="page" className="text-foreground truncate">
              {projectName || "Project"}
            </span>
          </nav>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Open command palette"
            onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_EVENT))}
            className="text-muted-foreground shrink-0 gap-2 text-xs"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Search commands</span>
            <kbd className="border-border hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
              ⌘ / Ctrl K
            </kbd>
          </Button>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-[1_1_280px]">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="mt-3 h-4 w-56 max-w-full" />
              </>
            ) : (
              <>
                <h1 className="min-w-0">
                  <EditableProjectName
                    projectId={projectId}
                    name={projectName || "Project"}
                  />
                </h1>
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  {githubUrl && (
                    <a
                      href={githubUrl.replace(/\.git$/, "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground inline-flex max-w-full min-w-0 items-center gap-1.5 transition-colors"
                    >
                      <Github
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {githubUrl
                          .replace(/^https?:\/\/github\.com\//, "")
                          .replace(/\.git$/, "")}
                      </span>
                      <ExternalLink
                        className="size-3 shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                  )}
                  {lastSyncedAt && (
                    <span title={new Date(lastSyncedAt).toLocaleString()}>
                      {now
                        ? `Files synced ${formatRelativeShort(lastSyncedAt, now)}`
                        : "Files synced"}
                    </span>
                  )}
                  <IndexingStatusBadge
                    embeddingStatus={embeddingStatus}
                    indexedFileCount={indexedFileCount}
                    totalFileCount={totalFileCount}
                    totalFiles={totalFiles}
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={isLoading}
              onClick={onOpenCodeViewer}
            >
              <Code2 className="size-4" />
              Browse code
            </Button>
            <Button
              disabled={
                isLoading ||
                !actions.canAsk ||
                actions.asking ||
                actions.deleting
              }
              onClick={actions.askAI}
              title={
                actions.canAsk
                  ? "Start a project chat"
                  : "AI chat becomes available when the repository index is ready"
              }
            >
              {actions.asking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageSquare className="size-4" />
              )}
              {actions.asking ? "Opening…" : "Ask AI"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={isLoading}
              aria-label="Open project details"
              onClick={onOpenDetails}
              className="text-muted-foreground"
            >
              <PanelRight className="size-4" />
            </Button>
            {!isLoading && <ProjectOptionsDropdown />}
          </div>
        </div>
      </div>
    </header>
  );
}
export default memo(ProjectHeader);
