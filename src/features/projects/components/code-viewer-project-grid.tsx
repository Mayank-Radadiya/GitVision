"use client";

/**
 * Code Viewer — Project Picker
 *
 * Command-first list: a jump input filters projects by name or repo path,
 * rows stay dense (avatar + name + path + file count + top language +
 * synced age). Index state is a small text adornment, not a dashboard.
 */

import { memo, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code, Search, ChevronRight, ArrowRight } from "lucide-react";
import { trpc } from "@/src/lib/trpc/client";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Input } from "@/shared/components/ui/input";
import {
  formatCount,
  formatRelativeShort,
} from "@/shared/lib/format";
import type { LanguageEntry } from "@/db/schema";

type ProjectRow = {
  id: string;
  projectName: string;
  githubUrl: string;
  totalFiles: number;
  languages: LanguageEntry[] | null;
  embeddingStatus: string | null;
  indexedFileCount: number;
  totalFileCount: number;
  lastSyncedAt: Date | null;
  createdAt: Date;
};

type SortMode = "recent" | "name";

/**
 * One-line index adornment. Only non-healthy states surface: a finished
 * run with searchable files needs no explanation on the row.
 */
function statusNote(project: ProjectRow): string | null {
  const status = project.embeddingStatus;
  if (status === "processing" || status === "pending") return "Indexing…";
  if (status === "partial") return "Partial index";
  if (status === "failed") return "Index failed";
  return null;
}

function repoPathOf(githubUrl: string): string {
  return githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "");
}

function topLanguage(languages: LanguageEntry[] | null): string | null {
  if (!languages || languages.length === 0) return null;
  return [...languages].sort((a, b) => b.size - a.size)[0]?.name ?? null;
}

function CodeViewerProjectGrid() {
  const { data, isLoading } = trpc.project.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const projects = (data ?? []) as ProjectRow[];
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const matches = !q
      ? [...projects]
      : projects.filter(
          (p) =>
            p.projectName.toLowerCase().includes(q) ||
            p.githubUrl.toLowerCase().includes(q),
        );
    matches.sort((a, b) => {
      if (sort === "name") return a.projectName.localeCompare(b.projectName);
      const aTime = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
      const bTime = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
      return bTime - aTime;
    });
    return matches;
  }, [projects, query, sort]);

  const focusRow = useCallback((index: number) => {
    const clamped = Math.max(
      0,
      Math.min(index, listRef.current?.childElementCount ?? 1 - 1),
    );
    setActiveIndex(clamped);
    const link = listRef.current?.querySelectorAll("a[data-row-link]")[clamped];
    (link as HTMLElement | undefined)?.focus();
  }, []);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setActiveIndex(0);
    },
    [],
  );

  const pageHeader = (
    <div className="flex items-center gap-3">
      <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
        <Code className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-foreground text-2xl font-bold">Code Viewer</h1>
        <p className="text-muted-foreground text-sm">
          Jump to a project and browse its source
        </p>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-4 px-4 py-8">
        {pageHeader}
        <Skeleton className="h-10 w-full rounded-xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
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
          <p className="text-muted-foreground mb-6 max-w-sm text-sm">
            Create a project from a GitHub repository to browse its source
            code here.
          </p>
          <Link
            href="/create-project"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          >
            Create a project
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-4 px-4 py-8">
      {pageHeader}

      {/* Command */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            aria-label="Jump to project"
            placeholder="Jump to project…"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
                setActiveIndex(0);
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                focusRow(activeIndex + 1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                focusRow(activeIndex - 1);
              } else if (event.key === "Enter") {
                const target = filtered[Math.min(activeIndex, filtered.length - 1)];
                if (target) {
                  router.push(`/code-viewer/${target.id}`);
                }
              }
            }}
            className="pl-9"
          />
        </div>
        <div role="group" aria-label="Sort projects" className="flex shrink-0 gap-1">
          {(["recent", "name"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={sort === mode}
              onClick={() => setSort(mode)}
              className={
                sort === mode
                  ? "bg-primary/10 text-primary rounded-md px-2.5 py-1.5 text-xs font-medium capitalize"
                  : "text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1.5 text-xs font-medium capitalize"
              }
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* No match */}
      {filtered.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No projects match &ldquo;{query.trim()}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-primary hover:text-primary/80 mt-2 cursor-pointer text-xs font-medium"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Dense list */}
      <ul ref={listRef} className="border-border/60 divide-y divide-border/60 rounded-xl border">
        {filtered.map((project) => {
          const total = Math.max(project.totalFileCount, project.totalFiles, 0);
          const lang = topLanguage(project.languages);
          const note = statusNote(project);
          const recency = project.lastSyncedAt
            ? `Synced ${formatRelativeShort(project.lastSyncedAt)}`
            : "Never synced";
          return (
            <li key={project.id}>
              <Link
                href={`/code-viewer/${project.id}`}
                data-row-link
                className="hover:bg-accent/40 flex items-center gap-3 px-4 py-3 transition-colors outline-none focus-visible:ring-ring/70 focus-visible:ring-2 focus-visible:ring-inset"
              >
                <span
                  className="from-primary/15 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br to-blue-400/15 text-sm font-bold"
                  aria-hidden="true"
                >
                  {project.projectName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-sm font-medium">
                    {project.projectName}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {repoPathOf(project.githubUrl)}
                  </span>
                </span>
                <span className="text-muted-foreground hidden shrink-0 text-xs tabular-nums sm:block">
                  {formatCount(total)} files{lang ? ` · ${lang}` : ""}
                </span>
                {note && (
                  <span className="text-muted-foreground/70 hidden shrink-0 text-[11px] md:block">
                    {note}
                  </span>
                )}
                <span className="text-muted-foreground shrink-0 text-[11px]">
                  {recency}
                </span>
                <ChevronRight
                  className="text-muted-foreground/50 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default memo(CodeViewerProjectGrid);
