/**
 * CONFIRMATION CARD — Parsed repository + AI credit ledger
 *
 * Revealed only once the URL field parses to owner/repo. This is the only place
 * on the page that states what will be charged, so the balance is read here
 * rather than duplicated into the form.
 */

"use client";

import { AlertTriangle, ArrowRight, Coins, ExternalLink } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useCredits } from "@/features/dashboard/hooks/use-dashboard";
import { PROJECT_CREATION_COST } from "../add-repo.constants";
import type { RepoInfo } from "../add-repo.constants";

interface ConfirmationCardProps {
  repoInfo?: RepoInfo | null;
  className?: string;
}

export function ConfirmationCard({ repoInfo, className }: ConfirmationCardProps) {
  const { data: credits } = useCredits();

  // `undefined` means the balance is still in flight. Rendering a placeholder
  // number would be a lie the user could act on, so show a dash instead.
  const creditsResolved = typeof credits === "number";
  const hasEnoughCredits = creditsResolved
    ? credits >= PROJECT_CREATION_COST
    : true;
  const balanceAfter = creditsResolved
    ? Math.max(0, credits - PROJECT_CREATION_COST)
    : null;

  return (
    <div className={cn("gv-card p-5", className)}>
      {repoInfo ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="font-gv-mono text-gv-bone truncate text-sm font-medium">
            {repoInfo.owner}{" "}
            <span aria-hidden="true" className="text-gv-fog/60">
              /
            </span>{" "}
            {repoInfo.repo}
          </span>
          <a
            href={`https://github.com/${repoInfo.owner}/${repoInfo.repo}`}
            target="_blank"
            rel="noreferrer"
            className="text-gv-fog hover:text-gv-bone inline-flex shrink-0 items-center gap-1 text-[11px] underline-offset-2 hover:underline"
          >
            <span>GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : null}

      <div className="border-gv-hairline/60 bg-gv-graphite-2/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 font-gv-mono text-[11px]">
        <span className="text-gv-fog inline-flex items-center gap-1.5">
          <Coins aria-hidden="true" className="h-3 w-3" />
          Current
        </span>
        <span className="text-gv-bone font-medium">
          {creditsResolved ? credits : "—"}
        </span>

        <ArrowRight aria-hidden="true" className="text-gv-fog/50 h-3 w-3" />

        <span className="text-gv-fog">Deduction</span>
        <span className="text-gv-amber font-semibold">
          −{PROJECT_CREATION_COST}
        </span>

        <ArrowRight aria-hidden="true" className="text-gv-fog/50 h-3 w-3" />

        <span className="text-gv-fog">Remaining</span>
        <span
          className={cn(
            "font-bold",
            creditsResolved && !hasEnoughCredits ? "text-gv-ember" : "text-gv-moss",
          )}
        >
          {balanceAfter ?? "—"}
        </span>
      </div>

      {creditsResolved && !hasEnoughCredits ? (
        <p
          role="alert"
          className="border-gv-ember/40 bg-gv-ember/10 text-gv-ember mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>
            {credits} credits available — {PROJECT_CREATION_COST} are required
            to index a repository.
          </span>
        </p>
      ) : null}
    </div>
  );
}