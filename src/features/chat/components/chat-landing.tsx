"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  FolderGit2,
  Sparkles,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  Database,
  X,
} from "lucide-react";
import { Button } from "@/src/shared/components/ui/button";
import { Badge } from "@/src/shared/components/ui/badge";
import {
  isTerminalStatus,
  type IndexingProgressEvent,
} from "@/src/lib/embedding-progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/shared/components/ui/select";
import { trpc } from "@/src/lib/trpc/client";
import { logger } from "@/src/lib/logger";
import { formatDistanceToNow } from "date-fns";
import { ChatActionsMenu } from "./chat-actions-menu";

interface Project {
  id: string;
  name: string;
  embeddingStatus: string | null;
}

interface Chat {
  id: string;
  title: string;
  type: string;
  projectId: string | null;
  updatedAt: Date;
}

interface ChatLandingProps {
  projects: Project[];
  chats: Chat[];
}

function StatusDot({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    completed: "bg-emerald-500",
    processing: "bg-blue-500 animate-pulse",
    failed: "bg-red-500",
  };
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[status ?? ""] ?? "bg-zinc-600"}`}
    />
  );
}

/**
 * One row of the Recent conversations list (F-07).
 *
 * A div with button semantics rather than a <button>: the row carries the
 * actions menu, and a button cannot contain the menu's button trigger.
 * Keyboard behavior matches: Enter/Space navigates, the menu trigger and
 * the inline rename form stop propagation so they never navigate.
 */
function RecentChatRow({
  chat,
  projectName,
}: {
  chat: Chat;
  projectName?: string;
}) {
  const router = useRouter();
  const [displayTitle, setDisplayTitle] = useState(chat.title);
  const [deleted, setDeleted] = useState(false);

  // The list is a static server prop, so a delete hides the row locally;
  // the menu already invalidates getAll for every other reader.
  if (deleted) return null;

  const open = () => router.push(`/chat/${chat.id}`);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open chat ${displayTitle}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="group hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
    >
      <MessageSquare className="text-muted-foreground/50 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{displayTitle}</p>
      </div>
      {projectName && (
        <Badge
          variant="outline"
          className="border-border/30 text-muted-foreground shrink-0 gap-1 font-mono text-[10px]"
        >
          <FolderGit2 className="h-2.5 w-2.5" />
          {projectName}
        </Badge>
      )}
      <span className="text-muted-foreground/50 shrink-0 text-[10px]">
        {formatDistanceToNow(new Date(chat.updatedAt), {
          addSuffix: true,
        })}
      </span>
      <ChatActionsMenu
        chatId={chat.id}
        title={displayTitle}
        variant="row"
        onRenamed={setDisplayTitle}
        onDeleted={() => setDeleted(true)}
      />
    </div>
  );
}

export function ChatLanding({ projects, chats }: ChatLandingProps) {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [embeddingStates, setEmbeddingStates] = useState<
    Record<
      string,
      {
        status: string;
        progress: number;
        error?: string | null;
        indexedFileCount?: number;
        totalFileCount?: number;
      }
    >
  >({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const getProjectStatus = useCallback(
    (projectId: string) => {
      if (embeddingStates[projectId]) return embeddingStates[projectId].status;
      const project = projects.find((p) => p.id === projectId);
      return project?.embeddingStatus ?? "pending";
    },
    [embeddingStates, projects],
  );

  const getProjectProgress = useCallback(
    (projectId: string) => {
      return embeddingStates[projectId]?.progress ?? 0;
    },
    [embeddingStates],
  );

  const getProjectCounts = useCallback(
    (projectId: string) => ({
      indexedFileCount: embeddingStates[projectId]?.indexedFileCount ?? 0,
      totalFileCount: embeddingStates[projectId]?.totalFileCount ?? 0,
    }),
    [embeddingStates],
  );

  const selectedProjectData = projects.find((p) => p.id === selectedProject);
  const currentStatus = selectedProject
    ? getProjectStatus(selectedProject)
    : null;
  // "partial" is a working index that covers only the capped file set, so the
  // project is ready for codebase chat — just not over every file.
  const isEmbeddingReady =
    currentStatus === "completed" || currentStatus === "partial";
  const isProcessing = currentStatus === "processing";
  // Live counters for the selected project; 0/0 hides the "N of M" line until
  // the pipeline has actually discovered a file set.
  const counts = selectedProject
    ? getProjectCounts(selectedProject)
    : { indexedFileCount: 0, totalFileCount: 0 };

  // Verify actual embedding status when a project is selected
  // (catches stale "completed" status when DB is empty)
  useEffect(() => {
    if (!selectedProject) return;

    const verifyStatus = async () => {
      try {
        const res = await fetch(`/api/embeddings?projectId=${selectedProject}`);
        if (!res.ok) return;
        const data = await res.json();

        setEmbeddingStates((prev) => ({
          ...prev,
          [selectedProject]: {
            status: data.status,
            progress: data.progress ?? 0,
            error: data.error,
            indexedFileCount: data.indexedFileCount ?? 0,
            totalFileCount: data.totalFileCount ?? 0,
          },
        }));
      } catch {
        // Ignore verification errors
      }
    };

    verifyStatus();
  }, [selectedProject]);

  // Live indexing progress over SSE.
  //
  // The server closes the stream on any terminal status (completed, partial or
  // failed). On a transport error we read one snapshot so a truncated stream —
  // a proxy timeout, or the platform's function-duration cap on a long run —
  // never leaves a frozen bar behind. EventSource reconnects on its own by
  // default, which would silently re-open a connection we already gave up on,
  // so we close it ourselves in onerror instead.
  useEffect(() => {
    if (!generatingFor) return;
    const projectId = generatingFor;

    const readSnapshot = async () => {
      try {
        const res = await fetch(`/api/embeddings?projectId=${projectId}`);
        if (!res.ok) return;
        const data = await res.json();

        setEmbeddingStates((prev) => ({
          ...prev,
          [projectId]: {
            status: data.status,
            progress: data.progress ?? 0,
            error: data.error,
            indexedFileCount: data.indexedFileCount ?? 0,
            totalFileCount: data.totalFileCount ?? 0,
          },
        }));
      } catch {
        // Ignore — the Retry button covers a dead snapshot.
      }
    };

    const source = new EventSource(
      `/api/embeddings/progress?projectId=${projectId}`,
    );

    source.onmessage = (message) => {
      let event: IndexingProgressEvent;
      try {
        event = JSON.parse(message.data) as IndexingProgressEvent;
      } catch {
        return;
      }

      setEmbeddingStates((prev) => ({
        ...prev,
        [projectId]: {
          status: event.status,
          progress: event.percentage ?? 0,
          error: event.error,
          indexedFileCount: event.indexedFileCount ?? 0,
          totalFileCount: event.totalFileCount ?? 0,
        },
      }));

      if (isTerminalStatus(event.status)) {
        source.close();
        setGeneratingFor(null);
      }
    };

    source.onerror = () => {
      source.close();
      void readSnapshot();
    };

    return () => source.close();
  }, [generatingFor]);

  const startEmbeddingGeneration = async (projectId: string) => {
    setGeneratingFor(projectId);
    setEmbeddingStates((prev) => ({
      ...prev,
      [projectId]: { status: "processing", progress: 0 },
    }));

    try {
      const res = await fetch("/api/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start");
      }
    } catch (error) {
      setEmbeddingStates((prev) => ({
        ...prev,
        [projectId]: {
          status: "failed",
          progress: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }));
      setGeneratingFor(null);
    }
  };

  const cancelEmbeddingGeneration = async (projectId: string) => {
    try {
      await fetch(`/api/embeddings?projectId=${projectId}`, {
        method: "DELETE",
      });

      setEmbeddingStates((prev) => ({
        ...prev,
        [projectId]: { status: "pending", progress: 0 },
      }));
      setGeneratingFor(null);
    } catch (error) {
      logger.error("Failed to cancel embedding generation", error);
    }
  };

  const createChatMutation = trpc.chat.create.useMutation({
    onSuccess: (data) => {
      router.push(`/chat/${data.id}`);
    },
  });

  const createChat = (type: "general" | "project") => {
    createChatMutation.mutate({
      type,
      ...(type === "project" && selectedProject
        ? { projectId: selectedProject }
        : {}),
    });
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      {/* Main content — centered */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl space-y-10">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              How can I help you?
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Ask general questions or select a project for codebase-aware chat.
            </p>
          </div>

          {/* Mode selection */}
          <div className="space-y-4">
            {/* Project selector */}
            <div className="border-border/50 bg-card/50 rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <FolderGit2 className="h-4 w-4 text-blue-500" />
                </div>
                <Select
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                >
                  <SelectTrigger className="h-9 flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0">
                    <SelectValue placeholder="Select a project for codebase chat..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-3">
                          <StatusDot status={getProjectStatus(project.id)} />
                          <span>{project.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Embedding states — only shown when project selected */}
              {selectedProject && (
                <div className="border-border/30 mt-3 border-t pt-3">
                  {/* Not indexed */}
                  {!isEmbeddingReady &&
                    !isProcessing &&
                    currentStatus !== "failed" && (
                      <div className="flex items-center justify-between">
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Database className="h-3.5 w-3.5" />
                          <span>
                            Embeddings required for{" "}
                            <span className="text-foreground font-medium">
                              {selectedProjectData?.name}
                            </span>
                          </span>
                        </div>
                        <Button
                          onClick={() =>
                            startEmbeddingGeneration(selectedProject)
                          }
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                        >
                          <Zap className="h-3 w-3" />
                          Generate
                        </Button>
                      </div>
                    )}

                  {/* Processing */}
                  {isProcessing && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                          <span className="text-muted-foreground">
                            Indexing{" "}
                            <span className="text-foreground font-medium">
                              {selectedProjectData?.name}
                            </span>
                          </span>
                          <span className="text-muted-foreground font-mono text-xs">
                            {getProjectProgress(selectedProject)}%
                          </span>
                        </div>
                        <Button
                          onClick={() =>
                            cancelEmbeddingGeneration(selectedProject)
                          }
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive h-7 gap-1 text-xs"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </Button>
                      </div>
                      <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{
                            width: `${getProjectProgress(selectedProject)}%`,
                          }}
                        />
                      </div>
                      {counts.totalFileCount > 0 && (
                        <p className="text-muted-foreground font-mono text-xs">
                          {counts.indexedFileCount} of {counts.totalFileCount}{" "}
                          files embedded
                        </p>
                      )}
                    </div>
                  )}

                  {/* Ready */}
                  {isEmbeddingReady && (
                    <div className="flex items-center gap-2 text-sm text-emerald-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Ready for codebase chat</span>
                    </div>
                  )}

                  {/* Failed */}
                  {currentStatus === "failed" && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-red-500">
                        <XCircle className="h-3.5 w-3.5" />
                        <span>
                          {embeddingStates[selectedProject]?.error ||
                            "Indexing failed"}
                        </span>
                      </div>
                      <Button
                        onClick={() =>
                          startEmbeddingGeneration(selectedProject)
                        }
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs"
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => createChat("general")}
                disabled={createChatMutation.isPending}
                variant="outline"
                className="h-11 flex-1 gap-2 text-sm"
              >
                {createChatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                General Chat
              </Button>
              <Button
                onClick={() => createChat("project")}
                disabled={
                  createChatMutation.isPending ||
                  !selectedProject ||
                  !isEmbeddingReady
                }
                className="h-11 flex-1 gap-2 bg-emerald-600 text-sm hover:bg-emerald-700"
              >
                {createChatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderGit2 className="h-4 w-4" />
                )}
                Codebase Chat
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent conversations — bottom */}
      {chats.length > 0 && (
        <div className="border-border/40 border-t px-6 py-5">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
              Recent conversations
            </h2>
            <div className="flex flex-col gap-1">
              {chats.slice(0, 5).map((chat) => {
                const project = projects.find((p) => p.id === chat.projectId);
                return (
                  <RecentChatRow
                    key={chat.id}
                    chat={chat}
                    projectName={project?.name}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
