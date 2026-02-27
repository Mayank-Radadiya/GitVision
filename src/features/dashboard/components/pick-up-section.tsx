"use client";

/**
 * "Pick Up Where You Left Off" — compact inline prompt bar.
 * Shows recent chat and latest commit as inline links in a single row.
 */

import { memo } from "react";
import Link from "next/link";
import { MessageSquare, GitCommit, ArrowRight } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { usePickUpWhereYouLeftOff } from "@/features/dashboard/hooks/use-dashboard";
import type { PickUpCard } from "@/features/dashboard/types/dashboard.types";

const ICON_MAP = {
  chat: MessageSquare,
  file: GitCommit,
  commit: GitCommit,
} as const;

const COLOR_MAP = {
  chat: { text: "text-blue-400" },
  file: { text: "text-cyan-400" },
  commit: { text: "text-amber-400" },
} as const;

function PickUpItem({ card }: { card: PickUpCard }) {
  const Icon = ICON_MAP[card.type];
  const colors = COLOR_MAP[card.type];

  return (
    <Link
      href={card.href}
      className="group flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-muted/30"
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", colors.text)} />
      <span className="truncate text-xs font-medium text-foreground">
        {card.title}
      </span>
      <span className="hidden truncate text-xs text-muted-foreground sm:inline">
        — {card.description}
      </span>
      <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function PickUpSection() {
  const { data, isLoading } = usePickUpWhereYouLeftOff();

  if (!isLoading && (!data || data.cards.length === 0)) return null;

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border/40 bg-card/40 px-2 py-1.5 backdrop-blur-sm">
      <span className="shrink-0 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        Resume
      </span>

      {isLoading ? (
        <div className="flex gap-3">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-6 w-48 rounded-lg" />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {data!.cards.map((card) => (
            <PickUpItem key={card.type} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(PickUpSection);
