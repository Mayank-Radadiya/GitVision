"use client";

/**
 * Code Viewer Detail — /code-viewer/[projectId]
 *
 * Displays project header + Shiki-powered code viewer.
 * Uses tRPC for project details and files.
 */

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Github,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useProjectDetails } from "@/features/projects/hooks/use-project";
import CodeViewer from "@/features/projects/components/project-view/code-viewer";

export default function CodeViewerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { data: project, isLoading, error } = useProjectDetails(projectId);

  // ─── Error ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="container mx-auto max-w-7xl py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg mx-auto text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 mx-auto mb-4">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Failed to load project
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred"}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push("/code-viewer")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium",
                "border border-border/40 bg-card/50 backdrop-blur-sm",
                "hover:bg-accent/50 transition-colors cursor-pointer",
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl py-6 px-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-48 mb-1.5" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-[70vh] w-full rounded-xl" />
      </div>
    );
  }

  const repoPath = project?.githubUrl?.replace(
    /^https?:\/\/(www\.)?github\.com\//,
    "",
  );

  return (
    <div className="container mx-auto max-w-7xl py-6 px-4 space-y-4">
      {/* Project Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={() => router.push("/code-viewer")}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              "border border-border/40 bg-card/50 backdrop-blur-sm",
              "hover:bg-accent/50 transition-colors cursor-pointer",
              "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Back to projects"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {/* Project avatar */}
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              "bg-gradient-to-br from-primary/15 to-blue-400/15",
              "text-primary font-bold text-base",
            )}
          >
            {project?.projectName?.charAt(0).toUpperCase() || "P"}
          </div>

          {/* Name & URL */}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">
              {project?.projectName || "Project"}
            </h1>
            {project?.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Github className="h-3 w-3" />
                <span className="truncate">{repoPath}</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
              </a>
            )}
          </div>
        </div>
      </motion.div>

      {/* Code Viewer (Shiki) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <CodeViewer projectId={projectId} />
      </motion.div>
    </div>
  );
}
