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
      className="group hover:bg-muted/30 flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors"
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", colors.text)} />
      <span className="text-foreground truncate text-xs font-medium">
        {card.title}
      </span>
      <span className="text-muted-foreground hidden truncate text-xs sm:inline">
        — {card.description}
      </span>
      <ArrowRight className="text-muted-foreground/40 ml-auto h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function PickUpSection() {
  const { data, isLoading } = usePickUpWhereYouLeftOff();

  if (!isLoading && (!data || data.cards.length === 0)) return null;

  return (
    <div className="border-border/40 bg-card/40 flex items-center gap-1 rounded-xl border px-2 py-1.5 backdrop-blur-sm">
      <span className="text-muted-foreground/60 shrink-0 px-2 text-[11px] font-semibold tracking-wider uppercase">
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
