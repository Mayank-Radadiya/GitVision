"use client";

import { memo, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, MoreHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import type { Commit } from "@/features/projects/types/project.types";
import type { LanguageEntry, RepoBriefing } from "@/db/schema";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import ProjectPulseWidget from "./project-pulse-widget";
import ContributorWidget from "./contributor-widget";
import TechStackWidget from "./tech-stack-widget";
import RepoBriefingCard from "./repo-briefing-card";

export function BentoCard({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card min-w-0 rounded-xl border p-6 shadow-xs",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface BentoGridProps {
  projectId: string;
  repoUrl: string;
  commits: Commit[];
  totalContributors: number;
  languages: LanguageEntry[];
  briefing: RepoBriefing | null | undefined;
  embeddingStatus: string | null | undefined;
}
const DEFAULT_ORDER = ["briefing", "insights", "activity"] as const;
type Section = (typeof DEFAULT_ORDER)[number];
const LABELS: Record<Section, string> = {
  briefing: "Repository briefing",
  insights: "Languages and contributors",
  activity: "Recent activity",
};

function BentoGrid({
  projectId,
  repoUrl,
  commits,
  totalContributors,
  languages,
  briefing,
  embeddingStatus,
}: BentoGridProps) {
  const [order, setOrder] = useState<Section[]>([...DEFAULT_ORDER]);
  const [dragging, setDragging] = useState<Section | null>(null);
  const [dropTarget, setDropTarget] = useState<Section | null>(null);
  const key = `gitvision:overview-order:${projectId}`;
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      if (
        Array.isArray(saved) &&
        saved.length === DEFAULT_ORDER.length &&
        new Set(saved).size === DEFAULT_ORDER.length &&
        saved.every((item) => DEFAULT_ORDER.includes(item))
      )
        setOrder(saved);
      else setOrder([...DEFAULT_ORDER]);
    } catch {
      setOrder([...DEFAULT_ORDER]);
    }
  }, [key]);
  function persist(next: Section[]) {
    setOrder(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Private browsing can disable storage; ordering still works in this session. */
    }
  }
  function move(section: Section, target: number) {
    const current = order.indexOf(section);
    if (target < 0 || target >= order.length || current === target) return;
    const previous = [...order];
    const next = [...order];
    next.splice(current, 1);
    next.splice(target, 0, section);
    persist(next);
    toast.dismiss(`overview-order-${projectId}`);
    toast(
      (notification) => (
        <div className="flex items-center gap-4 text-sm">
          <span>{LABELS[section]} moved</span>
          <button
            className="font-medium underline underline-offset-4 focus-visible:outline-2"
            onClick={() => {
              persist(previous);
              toast.dismiss(notification.id);
            }}
          >
            Undo
          </button>
        </div>
      ),
      { id: `overview-order-${projectId}`, duration: 6000 },
    );
  }
  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-xs">
        Make it yours. Drag a section handle, or use its menu to reorder this
        overview.
      </p>
      {order.map((section, index) => (
        <section
          key={section}
          aria-label={LABELS[section]}
          onDragOver={(event) => {
            if (dragging) {
              event.preventDefault();
              setDropTarget(section);
            }
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setDropTarget(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragging) move(dragging, index);
            setDragging(null);
            setDropTarget(null);
          }}
          className={cn(
            "rounded-xl transition-opacity duration-200",
            dragging === section && "opacity-50",
            dropTarget === section &&
              dragging !== section &&
              "ring-ring ring-2",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", section);
                  setDragging(section);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setDropTarget(null);
                }}
                title={`Drag ${LABELS[section]}`}
                className="text-muted-foreground cursor-grab rounded p-1 active:cursor-grabbing"
              >
                <GripVertical className="size-4" aria-hidden="true" />
              </span>
              <h3 className="text-muted-foreground text-xs font-medium">
                {LABELS[section]}
              </h3>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Reorder ${LABELS[section]}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={index === 0}
                  onSelect={() => move(section, index - 1)}
                >
                  <ArrowUp />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={index === order.length - 1}
                  onSelect={() => move(section, index + 1)}
                >
                  <ArrowDown />
                  Move down
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {section === "briefing" && (
            <BentoCard>
              <RepoBriefingCard
                briefing={briefing}
                embeddingStatus={embeddingStatus}
              />
            </BentoCard>
          )}
          {section === "insights" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <BentoCard>
                <TechStackWidget languages={languages} />
              </BentoCard>
              <BentoCard>
                <ContributorWidget
                  commits={commits}
                  totalContributors={totalContributors}
                />
                <p className="text-muted-foreground mt-4 text-xs">
                  Based on loaded commit history.
                </p>
              </BentoCard>
            </div>
          )}
          {section === "activity" && (
            <BentoCard>
              <ProjectPulseWidget projectId={projectId} repoUrl={repoUrl} />
            </BentoCard>
          )}
        </section>
      ))}
    </div>
  );
}
export default memo(BentoGrid);
export { BentoGrid };
