"use client";

/**
 * Code Viewer Detail — /code-viewer/[projectId]
 *
 * A full-bleed application shell, not a page in a content column.
 *
 * The route used to sit inside `container mx-auto max-w-7xl` and hand the
 * viewer a `h-[70vh]` skeleton while its data resolved, which meant the reading
 * surface was a box *inside* a page — so the page scrolled, then the viewer
 * scrolled, then the code scrolled. Three scroll contexts for one scroll's
 * worth of content.
 *
 * The shell is now `h-[100dvh]` and the viewer is `flex-1 min-h-0` inside it:
 * the page does not scroll at all, the code body is the only scroller, and the
 * viewer's own internal panes are free to be taller than any fixed height.
 *
 * Per-file facts deliberately live in the viewer, not here. This header answers
 * one question — *which repository am I in* — and defers every other one to the
 * command bar, the status line, and the insights drawer.
 */

import { useParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Github,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useProjectDetails } from "@/features/projects/hooks/use-project";
import CodeViewer from "@/features/projects/components/project-view/code-viewer";

/** Header and footer chrome, in rem, reserved out of the 100dvh shell. */
const CHROME_HEIGHT = "3.5rem";

export default function CodeViewerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { data: project, isLoading, error } = useProjectDetails(projectId);

  const repoPath = project?.githubUrl?.replace(
    /^https?:\/\/(www\.)?github\.com\//,
    "",
  );

  // ─── Error ─────────────────────────────────────────────────────────────
  // The technical message is kept behind a disclosure. A 404 from
  // `assertProjectOwnership` is the common case and its raw text leaks
  // nothing useful to a reader, while a real transport error sometimes does.
  if (error) {
    return (
      <div className="flex h-[100dvh] items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
            <AlertTriangle className="text-destructive h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mb-1.5 text-base font-semibold">
            Could not open this repository
          </h2>
          <p className="text-muted-foreground mb-5 text-sm">
            The viewer needs the project to load before it can show any files.
          </p>
          <details className="text-muted-foreground bg-muted/30 mb-5 rounded-lg px-3 py-2 text-left text-xs">
            <summary className="cursor-pointer">Technical detail</summary>
            <p className="mt-2 font-mono break-words">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </details>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/code-viewer")}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              All projects
            </Button>
            <Button size="sm" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* ─── Shell header: which repository, and how to leave ───────────── */}
      <motion.header
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ height: CHROME_HEIGHT }}
        className="border-border/60 bg-card/40 flex shrink-0 items-center gap-2.5 border-b px-3"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/code-viewer")}
          aria-label="Back to projects"
          title="Back to projects"
          className="text-muted-foreground hover:text-foreground size-8 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        <div
          className="from-primary/15 flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br to-blue-400/15 text-sm font-bold text-primary"
          aria-hidden="true"
        >
          {isLoading ? "…" : project?.projectName?.charAt(0).toUpperCase() || "P"}
        </div>

        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {isLoading ? "Loading project…" : project?.projectName || "Project"}
        </h1>

        {project?.githubUrl && (
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground hidden shrink-0 items-center gap-1.5 text-xs transition-colors sm:inline-flex"
          >
            <Github className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="max-w-56 truncate">{repoPath}</span>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </motion.header>

      {/* ─── The viewer fills whatever the header leaves ────────────────── */}
      {/* Suspense covers CodeViewer's useSearchParams (?file=/?line= deep
          links) so the route never de-opts during static rendering. */}
      <Suspense
        fallback={
          <div className="flex-1 space-y-3 p-4">
            <Skeleton className="h-8 w-full rounded-lg" />
            <div className="flex gap-3">
              <Skeleton className="h-[calc(100%-3.5rem)] w-72 rounded-lg" />
              <Skeleton className="h-[calc(100%-3.5rem)] flex-1 rounded-lg" />
            </div>
          </div>
        }
      >
        <CodeViewer projectId={projectId} fill="page" />
      </Suspense>
    </div>
  );
}
