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
  Wifi,
  ShieldCheck,
  MoreVertical,
  Trash2,
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
import { trpc } from "@/src/lib/trpc/client";

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
  const deleteMutation = trpc.project.delete.useMutation({
    onMutate: () => setIsDeleting(true),
    onSuccess: () => {
      toast.success("Project deleted successfully");
      router.push("/dashboard");
      router.refresh();
    },
    onError: (err) => {
      setIsDeleting(false);
      toast.error(err.message || "Failed to delete project");
    },
  });

  const handleDelete = () => {
    if (
      confirm(
        `Are you sure you want to delete ${projectName}? This action cannot be undone.`,
      )
    ) {
      deleteMutation.mutate({ projectId });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 border-border/50 hover:bg-muted/50 transition-colors"
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-red-500 hover:text-red-600 hover:bg-red-500/10 focus:text-red-600 focus:bg-red-500/10 cursor-pointer"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          {isDeleting ? "Deleting..." : "Delete Project"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
    <div className="relative flex-shrink-0 flex items-center justify-center">
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
        <span className="text-base font-bold text-foreground leading-none tabular-nums">
          {score}
        </span>
        <span className="text-[9px] text-muted-foreground leading-none mt-0.5 font-medium">
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
        className="gap-2 text-muted-foreground hover:text-foreground group cursor-pointer h-8 px-2"
      >
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform duration-150" />
        <span className="text-xs font-medium">Dashboard</span>
      </Button>

      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl"
      >
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
        <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/6 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent pointer-events-none" />

        <div className="relative px-6 py-5 md:px-7 md:py-6">
          <div className="flex items-start justify-between gap-4">
            {/* Left block — project info */}
            <div className="flex-1 min-w-0 space-y-3">
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
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[11px] h-6 px-2 w-fit"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <Wifi className="h-3 w-3" />
                    AI Synced
                  </Badge>

                  {/* Project Name */}
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl leading-tight">
                      {projectName || "Project Details"}
                    </h1>
                    {githubUrl && (
                      <Link
                        href={cleanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-primary transition-colors group/link cursor-pointer"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="opacity-70">{owner}/</span>
                        <span className="font-medium text-muted-foreground group-hover/link:underline underline-offset-4">
                          {repo}
                        </span>
                      </Link>
                    )}
                  </div>

                  {/* Quick stats pills */}
                  <div className="flex items-center gap-2 flex-wrap">
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
            <div className="flex flex-col items-end gap-4 flex-shrink-0">
              {/* Health Ring */}
              {!isLoading ? (
                <div className="flex flex-col items-center gap-1">
                  <HealthRing score={healthScore} />
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    Repo Health
                  </div>
                </div>
              ) : (
                <Skeleton className="h-[68px] w-[68px] rounded-full" />
              )}

              {/* Action buttons */}
              {!isLoading && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/chat/${projectId}`)}
                    className="gap-2 h-8 text-xs border-border/50 hover:border-primary/40 hover:bg-primary/5 hover:text-primary cursor-pointer transition-all"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Ask AI
                  </Button>
                  <Button
                    size="sm"
                    onClick={onOpenCodeViewer}
                    className="gap-2 h-8 text-xs bg-gradient-to-br from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#F97316] border-0 text-white font-semibold shadow-md hover:shadow-orange-500/20 hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
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
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/25 px-2.5 py-1 text-xs text-foreground/80">
      {icon}
      <span className="font-semibold tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export default memo(ProjectHeader);
