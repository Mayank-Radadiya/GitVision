"use client";

/**
 * Project list with search and sort.
 * Subscribes to useUserProjects() — isolated from header and stats rerenders.
 * Search and sort are client-side (no additional API calls).
 */

import { memo, useMemo, useState, useCallback } from "react";
import { FolderGit2 } from "lucide-react";
import { useUserProjects } from "@/features/dashboard/hooks/use-dashboard";
import type { ProjectSortKey } from "@/features/dashboard/types/dashboard.types";
import ProjectSearchBar from "./project-search-bar";
import ProjectCard from "./project-card";
import ProjectListSkeleton from "./project-list-skeleton";
import EmptyState from "../empty-state";

function ProjectList() {
  const { data: projects = [], isLoading } = useUserProjects();

  // ─── Local search/sort state ─────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ProjectSortKey>("recent");

  /** Filter projects by search query */
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.projectName.toLowerCase().includes(q) ||
        p.githubUrl.toLowerCase().includes(q),
    );
  }, [projects, query]);

  /** Sort filtered projects */
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortKey) {
      case "name":
        return list.sort((a, b) => a.projectName.localeCompare(b.projectName));
      case "commits":
        return list.sort((a, b) => b.totalCommits - a.totalCommits);
      case "stars":
        return list.sort((a, b) => b.star - a.star);
      case "recent":
      default:
        return list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }
  }, [filtered, sortKey]);

  const handleQueryChange = useCallback((q: string) => setQuery(q), []);
  const handleSortChange = useCallback(
    (k: ProjectSortKey) => setSortKey(k),
    [],
  );

  return (
    <div>
      {/* Section Header */}
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FolderGit2 className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Your Projects</h2>
      </div>

      {/* Search + Sort */}
      {!isLoading && projects.length > 0 && (
        <div className="mb-5">
          <ProjectSearchBar
            query={query}
            onQueryChange={handleQueryChange}
            sortKey={sortKey}
            onSortChange={handleSortChange}
            resultCount={sorted.length}
          />
        </div>
      )}

      {/* Content */}
      {isLoading && <ProjectListSkeleton />}

      {!isLoading && projects.length === 0 && <EmptyState />}

      {!isLoading && sorted.length === 0 && projects.length > 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No projects match &ldquo;{query}&rdquo;
        </p>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((project, i) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              projectName={project.projectName}
              githubUrl={project.githubUrl}
              star={project.star}
              forks={project.forks}
              totalCommits={project.totalCommits}
              totalContributors={project.totalContributors}
              createdAt={project.createdAt}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ProjectList);
