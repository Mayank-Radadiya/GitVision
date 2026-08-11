"use client";

/**
 * Code Viewer — Project Grid
 *
 * Displays all user projects as clickable cards.
 * Each card navigates to /code-viewer/[projectId] to view source code.
 */

import { memo, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  Code,
  Star,
  GitFork,
  GitCommit,
  Users,
  ExternalLink,
  ArrowRight,
  Clock,
  Search,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { trpc } from "@/src/lib/trpc/client";
import { Skeleton } from "@/shared/components/ui/skeleton";

/** Format large numbers: 1200 → "1.2k" */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function Stat({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Star;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm" title={label}>
      <Icon className={cn("h-3.5 w-3.5", color)} />
      <span className="text-foreground font-medium">{fmt(value)}</span>
    </div>
  );
}

function CodeViewerProjectGrid() {
  const { data: projects = [], isLoading } = trpc.project.getAll.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 },
  );
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.projectName.toLowerCase().includes(q) ||
        p.githubUrl.toLowerCase().includes(q),
    );
  }, [projects, query]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
    [],
  );

  // ─── Page header (shared across all states) ────────────────────────
  const pageHeader = (
    <div className="flex items-center gap-3">
      <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
        <Code className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-foreground text-2xl font-bold">Code Viewer</h1>
        <p className="text-muted-foreground text-sm">
          Select a project to browse its source code
        </p>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        {pageHeader}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        {pageHeader}
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <div className="bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
            <Code className="text-primary/50 h-8 w-8" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            No projects yet
          </h3>
          <p className="text-muted-foreground max-w-sm text-sm">
            Create a project from a GitHub repository to browse its source code
            here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      {pageHeader}
      {/* Search */}
      {projects.length > 3 && (
        <div className="relative max-w-md">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search projects…"
            className="border-border/40 bg-card/50 text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/20 focus:border-primary/30 w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none"
          />
        </div>
      )}

      {/* No results */}
      {filtered.length === 0 && query && (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No projects match &ldquo;{query}&rdquo;
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((project, i) => {
          const repoPath = project.githubUrl.replace(
            /^https?:\/\/(www\.)?github\.com\//,
            "",
          );
          const timeAgo = formatDistanceToNow(new Date(project.createdAt), {
            addSuffix: true,
          });

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <div
                onClick={() => router.push(`/code-viewer/${project.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && router.push(`/code-viewer/${project.id}`)
                }
                className="group border-border/60 hover:border-primary/30 bg-card/80 relative flex min-h-45 cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:shadow-lg"
                aria-label={`Browse code for ${project.projectName}`}
              >
                {/* Ambient glow */}
                <div className="from-primary absolute -top-6 -right-6 h-24 w-24 rounded-full bg-linear-to-br to-blue-400 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-20" />

                <div className="relative z-10 flex flex-col gap-4">
                  {/* Header: Avatar + Name */}
                  <div className="flex items-start gap-3">
                    <div className="from-primary/15 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br to-blue-400/15 text-base font-bold transition-transform duration-200 group-hover:scale-105">
                      {project.projectName.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-foreground group-hover:text-primary truncate font-semibold transition-colors">
                        {project.projectName}
                      </h3>
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-xs transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate">{repoPath}</span>
                      </a>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4">
                    <Stat
                      icon={Star}
                      value={project.star}
                      label="Stars"
                      color="text-amber-500"
                    />
                    <Stat
                      icon={GitFork}
                      value={project.forks}
                      label="Forks"
                      color="text-blue-500"
                    />
                    <Stat
                      icon={GitCommit}
                      value={project.totalCommits}
                      label="Commits"
                      color="text-emerald-500"
                    />
                    <Stat
                      icon={Users}
                      value={project.totalContributors}
                      label="Contributors"
                      color="text-cyan-500"
                    />
                  </div>
                </div>

                {/* Footer: Time + CTA */}
                <div className="border-border/30 relative z-10 mt-4 flex items-center justify-between border-t pt-3">
                  <div className="text-muted-foreground/60 flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    <span>{timeAgo}</span>
                  </div>

                  <div className="text-primary/70 group-hover:text-primary flex items-center gap-1 text-xs font-medium transition-colors">
                    <Code className="h-3.5 w-3.5" />
                    <span>Browse Code</span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(CodeViewerProjectGrid);
