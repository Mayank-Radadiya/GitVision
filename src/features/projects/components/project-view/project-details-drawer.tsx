"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { X, ExternalLink, Copy, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/shared/components/ui/button";
import { IndexingStatusBadge } from "./indexing-status-badge";
import EditableProjectName from "./editable-project-name";
import { useProjectActions } from "./project-actions";
import type { WorkspaceProject } from "./workspace-types";

export default function ProjectDetailsDrawer({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: WorkspaceProject;
}) {
  const actions = useProjectActions();
  const opener = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const date = (value: Date | string | null) =>
    value
      ? new Date(value).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not available";
  const properties = [
    [
      "Repository",
      project.githubUrl
        .replace(/^https:\/\/github\.com\//, "")
        .replace(/\.git$/, ""),
    ],
    ["Commits", project.totalCommits.toLocaleString()],
    ["Contributors", project.totalContributors.toLocaleString()],
    ["Branches", project.totalBranches.toLocaleString()],
    ["Stars", project.star.toLocaleString()],
    ["Forks", project.forks.toLocaleString()],
    [
      "Indexed files",
      `${project.indexedFileCount ?? "—"} / ${project.totalFileCount ?? project.totalFiles ?? "—"}`,
    ],
    ["Added", date(project.createdAt)],
    [
      "Last synced",
      project.lastSyncedAt
        ? date(project.lastSyncedAt)
        : "No completed re-sync",
    ],
  ];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="project-workspace data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fixed inset-0 z-50 bg-black/35 duration-150" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
          }}
          className="project-workspace border-border bg-background data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l shadow-xl duration-150 sm:max-w-[420px]"
        >
          <div className="border-border flex items-center justify-between border-b px-6 py-5">
            <Dialog.Title className="text-sm font-semibold">
              Project details
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close project details"
              >
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1 space-y-8 overflow-y-auto p-6">
            <Dialog.Description className="text-muted-foreground text-sm">
              A quick look at your repository. Select the name to edit it.
            </Dialog.Description>
            <div className="space-y-3">
              <EditableProjectName
                projectId={project.id}
                name={project.projectName}
              />
              <IndexingStatusBadge
                embeddingStatus={project.embeddingStatus}
                indexedFileCount={project.indexedFileCount}
                totalFileCount={project.totalFileCount}
                totalFiles={project.totalFiles}
              />
            </div>
            <dl className="divide-border divide-y">
              {properties.map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-2 gap-4 py-3 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 text-right font-medium break-words">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {project.embeddingStatus === "failed" && (
              <div
                role="status"
                className="border-destructive/30 bg-destructive/5 rounded-lg border p-4 text-sm"
              >
                <p className="text-destructive font-medium">
                  Indexing needs attention
                </p>
                <p className="text-muted-foreground mt-1">
                  Queue a file sync to retry repository indexing.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={actions.syncProject}
                  disabled={actions.syncing || actions.deleting}
                >
                  <RefreshCw className="size-3.5" />
                  {actions.syncing ? "Queueing…" : "Retry file sync"}
                </Button>
              </div>
            )}
            {project.embeddingStatus === "partial" && (
              <p className="border-border bg-muted/40 text-muted-foreground rounded-lg border p-4 text-sm">
                AI answers use the indexed subset of this repository. Files
                outside that subset may be missing from answers.
              </p>
            )}
          </div>
          <div className="border-border flex gap-2 border-t p-6">
            <Button variant="outline" className="flex-1" asChild>
              <a
                href={project.githubUrl.replace(/\.git$/, "")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                Open GitHub
              </a>
            </Button>
            <Button
              variant="outline"
              aria-label="Copy repository URL"
              onClick={() => {
                void navigator.clipboard.writeText(project.githubUrl).then(
                  () => toast.success("Repository URL copied"),
                  () => toast.error("Couldn’t copy the URL"),
                );
              }}
            >
              <Copy />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
