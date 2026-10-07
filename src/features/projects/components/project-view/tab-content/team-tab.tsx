"use client";

import { useMemo, useState } from "react";
import { Users, Search, Loader2 } from "lucide-react";
import { useProjectCommits } from "@/features/projects/hooks/use-project";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { SectionSkeleton } from "../workspace-skeleton";

export default function TeamTab({
  projectId,
  totalContributors,
}: {
  projectId: string;
  totalContributors: number;
}) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProjectCommits(projectId);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("commits");
  const contributors = useMemo(() => {
    const people = new Map<
      string,
      { name: string; avatar?: string | null; count: number }
    >();
    for (const commit of data?.pages.flatMap((page) => page.commits) ?? []) {
      const key =
        commit.authorEmail.trim().toLowerCase() ||
        commit.authorName.toLowerCase();
      if (/\[bot\]|github-actions|dependabot|renovate/i.test(commit.authorName))
        continue;
      const person = people.get(key);
      if (person) person.count++;
      else
        people.set(key, {
          name: commit.authorName,
          avatar: commit.authorAvatar,
          count: 1,
        });
    }
    return [...people.entries()]
      .filter(([, person]) =>
        person.name.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) =>
        sort === "name"
          ? a[1].name.localeCompare(b[1].name)
          : b[1].count - a[1].count,
      );
  }, [data, search, sort]);
  if (isLoading) return <SectionSkeleton />;
  if (isError)
    return (
      <div role="alert" className="border-border rounded-xl border p-6">
        <p>Couldn’t load contributors.</p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            aria-label="Search contributors"
            placeholder="Search contributors…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <select
          aria-label="Sort contributors"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="border-input bg-background rounded-md border px-3 py-2 text-sm"
        >
          <option value="commits">Most recent commits</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      <p className="text-muted-foreground text-xs">
        {totalContributors.toLocaleString()} contributors reported by GitHub.
        People below are from loaded commits; bot accounts are excluded. Counts
        reflect loaded history.
      </p>
      <div className="divide-border border-border bg-card divide-y rounded-xl border">
        {contributors.length ? (
          contributors.map(([key, person]) => (
            <div key={key} className="flex items-center gap-3 px-5 py-4">
              <Avatar className="size-9">
                <AvatarImage src={person.avatar || undefined} alt="" />
                <AvatarFallback className="bg-muted text-xs font-medium">
                  {person.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{person.name}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Repository contributor
                </p>
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                {person.count} commits
              </span>
            </div>
          ))
        ) : (
          <div className="px-6 py-12 text-center">
            <Users className="text-muted-foreground mx-auto mb-3 size-6" />
            <p className="text-sm font-medium">
              {search
                ? "No matching contributors"
                : "No contributors in loaded history"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {search
                ? "Try a different name."
                : "Contributors appear when commits are available."}
            </p>
          </div>
        )}
      </div>
      {hasNextPage && (
        <Button
          variant="outline"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage && <Loader2 className="animate-spin" />}
          {isFetchingNextPage ? "Loading history…" : "Load more history"}
        </Button>
      )}
    </div>
  );
}
