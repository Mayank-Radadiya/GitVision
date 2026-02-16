"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  FolderGit2,
  Sparkles,
  ArrowRight,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/shared/components/ui/select";
import { trpc } from "@/src/lib/trpc/client";
import { formatDistanceToNow } from "date-fns";

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

export function ChatLanding({ projects, chats }: ChatLandingProps) {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [embeddingStates, setEmbeddingStates] = useState<
    Record<string, { status: string; progress: number; error?: string | null }>
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

  const selectedProjectData = projects.find((p) => p.id === selectedProject);
  const currentStatus = selectedProject
    ? getProjectStatus(selectedProject)
    : null;
  const isEmbeddingReady = currentStatus === "completed";
  const isProcessing = currentStatus === "processing";

  // Poll for embedding progress
  useEffect(() => {
    if (!generatingFor) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/embeddings?projectId=${generatingFor}`);
        if (!res.ok) return;
        const data = await res.json();

        setEmbeddingStates((prev) => ({
          ...prev,
          [generatingFor]: {
            status: data.status,
            progress: data.progress ?? 0,
            error: data.error,
          },
        }));

        if (data.status === "completed" || data.status === "failed") {
          setGeneratingFor(null);
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => clearInterval(pollInterval);
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
      console.error("Failed to cancel:", error);
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
            <p className="mt-2 text-sm text-muted-foreground">
              Ask general questions or select a project for codebase-aware chat.
            </p>
          </div>

          {/* Mode selection */}
          <div className="space-y-4">
            {/* Project selector */}
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
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
                <div className="mt-3 border-t border-border/30 pt-3">
                  {/* Not indexed */}
                  {!isEmbeddingReady &&
                    !isProcessing &&
                    currentStatus !== "failed" && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Database className="h-3.5 w-3.5" />
                          <span>
                            Embeddings required for{" "}
                            <span className="font-medium text-foreground">
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
                            <span className="font-medium text-foreground">
                              {selectedProjectData?.name}
                            </span>
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {getProjectProgress(selectedProject)}%
                          </span>
                        </div>
                        <Button
                          onClick={() =>
                            cancelEmbeddingGeneration(selectedProject)
                          }
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </Button>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{
                            width: `${getProjectProgress(selectedProject)}%`,
                          }}
                        />
                      </div>
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
        <div className="border-t border-border/40 px-6 py-5">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recent conversations
            </h2>
            <div className="flex flex-col gap-1">
              {chats.slice(0, 5).map((chat) => {
                const project = projects.find((p) => p.id === chat.projectId);
                return (
                  <button
                    key={chat.id}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50 cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{chat.title}</p>
                    </div>
                    {project && (
                      <Badge
                        variant="outline"
                        className="shrink-0 gap-1 border-border/30 text-[10px] font-mono text-muted-foreground"
                      >
                        <FolderGit2 className="h-2.5 w-2.5" />
                        {project.name}
                      </Badge>
                    )}
                    <span className="shrink-0 text-[10px] text-muted-foreground/50">
                      {formatDistanceToNow(new Date(chat.updatedAt), {
                        addSuffix: true,
                      })}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/50" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
