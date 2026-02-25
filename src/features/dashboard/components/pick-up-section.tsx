"use client";

/**
 * "Pick Up Where You Left Off" — horizontal quick-action cards.
 * Shows the user's most recent chat session and latest commit
 * so they can jump back into context instantly.
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
  chat: {
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    border: "border-blue-500/20",
  },
  file: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-500",
    border: "border-cyan-500/20",
  },
  commit: {
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    border: "border-amber-500/20",
  },
} as const;

function PickUpCard({ card }: { card: PickUpCard }) {
  const Icon = ICON_MAP[card.type];
  const colors = COLOR_MAP[card.type];

  return (
    <Link href={card.href} className="group block flex-1">
      <div
        className={cn(
          "relative h-full rounded-xl border bg-card/60 p-4 backdrop-blur-sm",
          "transition-all duration-200",
          "hover:bg-card/90 hover:shadow-md",
          "cursor-pointer",
          colors.border,
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            "mb-3 flex h-8 w-8 items-center justify-center rounded-lg",
            colors.bg,
          )}
        >
          <Icon className={cn("h-4 w-4", colors.text)} />
        </div>

        {/* Content */}
        <p className="text-sm font-medium text-foreground">{card.title}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {card.description}
        </p>

        {/* Project badge */}
        <div className="mt-3 flex items-center justify-between">
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
              colors.bg,
              colors.text,
            )}
          >
            {card.projectName}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}

function PickUpSection() {
  const { data, isLoading } = usePickUpWhereYouLeftOff();

  if (!isLoading && (!data || data.cards.length === 0)) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        Pick up where you left off
      </h3>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data!.cards.map((card) => (
            <PickUpCard key={card.type} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(PickUpSection);
