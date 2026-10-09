"use client";

import { useMemo, useState } from "react";
import { useProjectInsights } from "@/features/projects/hooks/use-project";
import {
  ActivityWindowControl,
  type ActivityWindow,
} from "../overview/activity-panel";
import { initials, CONTRIBUTOR_CAP } from "../overview/top-contributors";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { formatCount } from "@/shared/lib/format";
import {
  EmptyState,
  InlineError,
  ListSkeleton,
  ListToolbar,
  SectionHeading,
} from "../workspace-ui";

export default function TeamTab({
  projectId,
  totalContributors,
  window,
  onWindowChange,
}: {
  projectId: string;
  totalContributors: number;
  window: ActivityWindow;
  onWindowChange: (days: ActivityWindow) => void;
}) {
  const { data, isLoading, isError, refetch, isFetching, isPlaceholderData } =
    useProjectInsights(projectId, window);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("commits");
  const contributors = useMemo(
    () => data?.contributors ?? [],
    [data?.contributors],
  );
  const visible = useMemo(
    () =>
      contributors
        .filter((person) =>
          `${person.name} ${person.email}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : b.commits - a.commits,
        ),
    [contributors, search, sort],
  );
  const served = data?.days;
  const days = served === 7 || served === 30 || served === 90 ? served : window;
  const max = Math.max(1, ...contributors.map((person) => person.commits));
  return (
    <div className="space-y-5">
      <SectionHeading
        title="Contributors"
        description="The people behind recent changes, ranked by commits."
        action={
          <ActivityWindowControl days={window} onChange={onWindowChange} />
        }
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        label="Search contributors"
        placeholder="Search contributors…"
      >
        <select
          aria-label="Sort contributors"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="commits">Most commits</option>
          <option value="name">Name A–Z</option>
        </select>
      </ListToolbar>
      <p className="text-muted-foreground text-xs">
        {formatCount(totalContributors)} contributors reported by GitHub, all
        time. Below: activity in the last {days} days.
      </p>
      {isError && (
        <InlineError
          message={
            data
              ? "Couldn’t refresh contributors. Showing the last available data."
              : "Couldn’t load contributors."
          }
          onRetry={() => void refetch()}
          pending={isFetching}
        />
      )}
      {isPlaceholderData && (
        <p role="status" className="text-muted-foreground text-xs">
          Loading the {window}-day view. Showing the previous {days}-day period.
        </p>
      )}
      <div
        aria-busy={isFetching}
        className="divide-border border-border bg-card divide-y overflow-hidden rounded-xl border"
      >
        {isLoading ? (
          <ListSkeleton />
        ) : visible.length ? (
          visible.map((person, index) => (
            <div
              key={person.email}
              className="hover:bg-muted/30 flex items-center gap-3 px-4 py-4 transition-colors sm:px-5"
            >
              <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
                {index + 1}
              </span>
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={person.avatar || undefined} alt="" />
                <AvatarFallback className="text-xs">
                  {initials(person.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={person.name}>
                  {person.name}
                </p>
                <div className="bg-muted mt-2 h-1 max-w-xs overflow-hidden rounded-full">
                  <div
                    className="bg-primary/65 h-full rounded-full"
                    style={{ width: `${(person.commits / max) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatCount(person.commits)}{" "}
                {person.commits === 1 ? "commit" : "commits"}
              </span>
            </div>
          ))
        ) : (
          (data || !isError) && (
            <EmptyState
              title={
                search ? "No matching contributors" : "No contributor activity"
              }
              description={
                search
                  ? "Try another name or clear the search."
                  : `No human contributors were found in the last ${days} days. Bot accounts are excluded.`
              }
              action={
                search ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearch("")}
                  >
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          )
        )}
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {contributors.length >= CONTRIBUTOR_CAP
          ? `Top ${CONTRIBUTOR_CAP}+ authors in the last ${days} days; search covers these ranked results.`
          : `Contributors in the last ${days} days.`}{" "}
        Bot accounts are excluded.
      </p>
    </div>
  );
}
