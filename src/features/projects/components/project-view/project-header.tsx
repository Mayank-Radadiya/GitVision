"use client";

import { memo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ChevronRight,
  ExternalLink,
  FolderGit2,
  Code,
  MessageSquare,
  MoreVertical,
  Trash2,
  RefreshCw,
  Loader2,
  PanelRight,
  Search,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { trpc } from "@/src/lib/trpc/client";
import { IndexingStatusBadge } from "./indexing-status-badge";
import EditableProjectName from "./editable-project-name";
import { OPEN_COMMAND_EVENT } from "./workspace-navigation";

export function ProjectOptionsDropdown({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const deleteMutation = trpc.project.delete.useMutation({
    onMutate: () => setIsDeleting(true),
    onSuccess: () => {
      toast.success("Project deleted successfully");
      router.push("/dashboard");
      router.refresh();
    },
    onError: (err) => {
      setIsDeleting(false);
      setIsAlertOpen(false);
      toast.error(err.message || "Failed to delete project");
    },
  });
  const resyncMutation = trpc.project.resync.useMutation({
    onSuccess: () => {
      void utils.project.getDetails.invalidate({ projectId });
      toast.success("Sync started — this runs in the background");
    },
    onError: (err) => toast.error(err.message || "Failed to start sync"),
  });

  const handleDelete = () => {
    deleteMutation.mutate({ projectId });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label="Project actions menu"
            className="border-border/50 hover:bg-muted/50 h-8 w-8 p-0 transition-colors"
          >
            <MoreVertical className="text-muted-foreground h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={() => resyncMutation.mutate({ projectId })}
            disabled={resyncMutation.isPending || isDeleting}
            className="focus:bg-muted/50 cursor-pointer"
          >
            {resyncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {resyncMutation.isPending ? "Starting sync..." : "Sync now"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIsAlertOpen(true);
            }}
            onClick={() => setIsAlertOpen(true)}
            disabled={isDeleting}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {isDeleting ? "Deleting..." : "Delete Project"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {projectName}? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Project"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
}: ProjectHeaderProps) {
  const router = useRouter();
  return (
    <header className="border-border bg-background/95 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-5 pt-5 pb-5 sm:px-8 lg:px-10">
        <div className="mb-6 flex h-8 items-center justify-between gap-3 pl-12 md:pl-0">
          <nav
            aria-label="Breadcrumb"
            className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs"
          >
            <Link
              href="/dashboard"
              className="hover:text-foreground focus-visible:outline-ring rounded focus-visible:outline-2"
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
            className="text-muted-foreground shrink-0"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search commands</span>
            <kbd className="border-border hidden rounded border px-1.5 text-xs sm:inline">
              ⌘ / Ctrl K
            </kbd>
          </Button>
        </div>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="border-border bg-muted/50 flex size-11 shrink-0 items-center justify-center rounded-xl border">
              <FolderGit2 className="text-primary size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <>
                  <Skeleton className="mb-2 h-8 w-48" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <h1 className="min-w-0">
                    <EditableProjectName
                      projectId={projectId}
                      name={projectName || "Project"}
                    />
                  </h1>
                  {githubUrl && (
                    <a
                      href={githubUrl.replace(/\.git$/, "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground focus-visible:outline-ring mt-1 flex w-fit max-w-full items-center gap-1.5 rounded text-xs focus-visible:outline-2"
                    >
                      <span className="truncate">
                        {githubUrl
                          .replace(/^https?:\/\/github\.com\//, "")
                          .replace(/\.git$/, "")}
                      </span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isLoading && (
              <IndexingStatusBadge
                embeddingStatus={embeddingStatus}
                totalFiles={totalFiles}
                indexedFileCount={indexedFileCount}
                totalFileCount={totalFileCount}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={onOpenCodeViewer}
            >
              <Code />
              Files
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={isLoading}
              aria-label="Open project details"
              onClick={onOpenDetails}
            >
              <PanelRight />
            </Button>
            <Button
              size="sm"
              disabled={isLoading}
              onClick={() => router.push(`/chat/${projectId}`)}
            >
              <MessageSquare />
              Ask AI
            </Button>
            {!isLoading && (
              <ProjectOptionsDropdown
                projectId={projectId}
                projectName={projectName || "Project"}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
export default memo(ProjectHeader);
