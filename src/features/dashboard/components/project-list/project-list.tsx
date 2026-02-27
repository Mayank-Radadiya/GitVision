"use client";

/**
 * Project list with search and sort.
 * Subscribes to useUserProjects() — isolated from header and stats rerenders.
 */

import { memo, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { FolderGit2 } from "lucide-react";
import { useUserProjects } from "@/features/dashboard/hooks/use-dashboard";
import type { ProjectSortKey } from "@/features/dashboard/types/dashboard.types";
import ProjectSearchBar from "./project-search-bar";
import ProjectCard from "./project-card";
import ProjectListSkeleton from "./project-list-skeleton";
import EmptyState from "../empty-state";

const listStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

function ProjectList() {
  const { data, isLoading } = useUserProjects();

  const projects = useMemo(() => {
    return Array.isArray(data) ? data : [];
  }, [data]);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ProjectSortKey>("recent");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.projectName.toLowerCase().includes(q) ||
        p.githubUrl.toLowerCase().includes(q),
    );
  }, [projects, query]);

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

  const [showAll, setShowAll] = useState(false);
  const DISPLAY_LIMIT = 6;
  const displayed = showAll ? sorted : sorted.slice(0, DISPLAY_LIMIT);
  const hasMore = sorted.length > DISPLAY_LIMIT;

  return (
    <div>
      {/* Section Header */}
      <div className="mb-4 flex items-center gap-2">
        <FolderGit2 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium text-foreground">Your Projects</h2>
        {projects.length > 0 && (
          <span className="text-xs text-muted-foreground/60">
            {projects.length}
          </span>
        )}
      </div>

      {/* Search + Sort */}
      {!isLoading && projects.length > 0 && (
        <div className="mb-4">
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
        <>
          <motion.div
            className="space-y-2"
            variants={listStagger}
            initial="hidden"
            animate="visible"
          >
            {displayed.map((project, i) => (
              <motion.div key={project.id} variants={listItem}>
                <ProjectCard
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
              </motion.div>
            ))}
          </motion.div>

          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-3 w-full text-center text-xs font-medium text-primary/70 hover:text-primary transition-colors py-2"
            >
              {showAll ? "Show less" : `View all ${sorted.length} projects`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default memo(ProjectList);
