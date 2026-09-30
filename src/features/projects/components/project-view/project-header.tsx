"use client";

/**
 * Project Header v2 — Includes Repository Health circular progress ring,
 * Stars/Forks pills, AI Syncing badge, and primary action buttons.
 */

import { memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  Star,
  GitFork,
  Code,
  MessageSquare,
  ShieldCheck,
  MoreVertical,
  Trash2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

import { useState } from "react";
import toast from "react-hot-toast";

// ─── Dropdown Actions ────────────────────────────────────────────────────────

function ProjectOptionsDropdown({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
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
    onSuccess: () => toast.success("Sync started — this runs in the background"),
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
            className="cursor-pointer focus:bg-muted/50"
          >
            {resyncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {resyncMutation.isPending ? "Starting sync..." : "Sync now"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIsAlertOpen(true);
            }}
            onClick={() => setIsAlertOpen(true)}
            disabled={isDeleting}
            className="cursor-pointer text-red-500 hover:bg-red-500/10 hover:text-red-600 focus:bg-red-500/10 focus:text-red-600"
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
              Are you sure you want to delete {projectName}? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
            >
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

// ─── Health Ring ──────────────────────────────────────────────────────────────

interface HealthRingProps {
  score: number; // 0–100
  size?: number;
}

function HealthRing({ score, size = 68 }: HealthRingProps) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const color =
    score >= 80
      ? "#22c55e" // green
      : score >= 55
        ? "#f59e0b" // amber
        : "#ef4444"; // red

  const label = score >= 80 ? "Excellent" : score >= 55 ? "Good" : "Needs Work";

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          className="text-muted/30"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-foreground text-base leading-none font-bold tabular-nums">
          {score}
        </span>
        <span className="text-muted-foreground mt-0.5 text-[9px] leading-none font-medium">
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── Health Score Derivation ─────────────────────────────────────────────────

function deriveHealthScore(
  stars: number,
  commits: number,
  contributors: number,
  branches: number,
): number {
  // Simple heuristic score (0–100)
  let score = 50;
  if (commits > 20) score += 15;
  else if (commits > 5) score += 8;
  if (contributors > 3) score += 15;
  else if (contributors > 1) score += 8;
  if (stars > 10) score += 10;
  else if (stars > 2) score += 5;
  if (branches > 2) score += 10;
  return Math.min(100, score);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectHeaderProps {
  projectName: string | undefined;
  githubUrl: string | undefined;
  stars: number | undefined;
  forks: number | undefined;
  totalCommits: number | undefined;
  totalContributors: number | undefined;
  totalBranches: number | undefined;
  isLoading: boolean;
  projectId: string;
  onOpenCodeViewer: () => void;
  embeddingStatus: string | null | undefined;
  totalFiles: number | null | undefined;
  indexedFileCount?: number | null;
  totalFileCount?: number | null;
  lastSyncedAt?: Date | string | null;
}

function extractOwnerRepo(url: string) {
  const clean = url
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "");
  const parts = clean.split("/");
  if (parts.length >= 2)
    return { owner: parts[0], repo: parts.slice(1).join("/") };
  return { owner: "", repo: clean };
}

// ─── Main Component ───────────────────────────────────────────────────────────

function ProjectHeader({
  projectName,
  githubUrl,
  stars,
  forks,
  totalCommits,
  totalContributors,
  totalBranches,
  isLoading,
  projectId,
  onOpenCodeViewer,
  embeddingStatus,
  totalFiles,
  indexedFileCount,
  totalFileCount,
  lastSyncedAt,
}: ProjectHeaderProps) {
  const router = useRouter();
  const cleanUrl = githubUrl?.replace(/\.git$/, "") || "";
  const { owner, repo } = githubUrl
    ? extractOwnerRepo(githubUrl)
    : { owner: "", repo: "" };
  const healthScore = deriveHealthScore(
    stars ?? 0,
    totalCommits ?? 0,
    totalContributors ?? 0,
    totalBranches ?? 0,
  );

  return (
    <div className="space-y-3">
      {/* Back Navigation */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard")}
        className="text-muted-foreground hover:text-foreground group h-8 cursor-pointer gap-2 px-2"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
        <span className="text-xs font-medium">Dashboard</span>
      </Button>

      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="border-border/50 bg-card/70 relative overflow-hidden rounded-2xl border backdrop-blur-xl"
      >
        {/* Gradient overlays */}
        <div className="from-primary/5 pointer-events-none absolute inset-0 bg-linear-to-br via-transparent to-purple-500/5" />
        <div className="bg-primary/6 pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl" />
        <div className="via-border/60 pointer-events-none absolute right-0 bottom-0 left-0 h-px bg-linear-to-r from-transparent to-transparent" />

        <div className="relative px-6 py-5 md:px-7 md:py-6">
          <div className="flex items-start justify-between gap-4">
            {/* Left block — project info */}
            <div className="min-w-0 flex-1 space-y-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-56" />
                  <Skeleton className="h-4 w-48" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-18 rounded-full" />
                    <Skeleton className="h-6 w-18 rounded-full" />
                  </div>
                </>
              ) : (
                <>
                  {/* Status badge */}
                  <IndexingStatusBadge
                    embeddingStatus={embeddingStatus}
                    totalFiles={totalFiles}
                    indexedFileCount={indexedFileCount}
                    totalFileCount={totalFileCount}
                  />

                  {/* Project Name */}
                  <div>
                    <h1 className="text-foreground text-2xl leading-tight font-bold tracking-tight md:text-3xl">
                      {projectName || "Project Details"}
                    </h1>
                    {githubUrl && (
                      <Link
                        href={cleanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground/60 hover:text-primary group/link mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="opacity-70">{owner}/</span>
                        <span className="text-muted-foreground font-medium underline-offset-4 group-hover/link:underline">
                          {repo}
                        </span>
                      </Link>
                    )}
                  </div>

                  {/* Quick stats pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    <StatPill
                      icon={<Star className="h-3 w-3 text-amber-400" />}
                      value={stars ?? 0}
                      label="stars"
                    />
                    <StatPill
                      icon={<GitFork className="h-3 w-3 text-blue-400" />}
                      value={forks ?? 0}
                      label="forks"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Right block — health ring + actions */}
            <div className="flex shrink-0 flex-col items-end gap-4">
              {/* Health Ring */}
              {!isLoading ? (
                <div className="flex flex-col items-center gap-1">
                  <HealthRing score={healthScore} />
                  <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
                    <ShieldCheck className="h-3 w-3" />
                    Repo Health
                  </div>
                </div>
              ) : (
                <Skeleton className="h-17 w-17 rounded-full" />
              )}

              {/* Action buttons */}
              {!isLoading && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/chat/${projectId}`)}
                    className="border-border/50 hover:border-primary/40 hover:bg-primary/5 hover:text-primary h-8 cursor-pointer gap-2 text-xs transition-all"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Ask AI
                  </Button>
                  <Button
                    size="sm"
                    onClick={onOpenCodeViewer}
                    className="h-8 cursor-pointer gap-2 border-0 bg-linear-to-br from-[#F97316] to-[#EA580C] text-xs font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:from-[#EA580C] hover:to-[#F97316] hover:shadow-lg hover:shadow-orange-500/20"
                  >
                    <Code className="h-3.5 w-3.5" />
                    Code Viewer
                  </Button>

                  <ProjectOptionsDropdown
                    projectId={projectId!}
                    projectName={projectName || ""}
                  />
                </div>
              )}

              {/* When the index was last current. Absent until a re-sync has
                  run — a project that has never been re-synced says nothing
                  rather than implying the import timestamp is a sync. */}
              {!isLoading && lastSyncedAt && (
                <p className="text-muted-foreground mt-1 text-right text-xs">
                  Last synced{" "}
                  {new Date(lastSyncedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatPill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="border-border/50 bg-muted/25 text-foreground/80 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
      {icon}
      <span className="font-semibold tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export default memo(ProjectHeader);
