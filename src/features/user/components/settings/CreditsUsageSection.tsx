"use client";

/**
 * Credits & Usage.
 *
 * Balance comes from `projectRouter.getCredits` and the ledger from
 * `userRouter.getCreditHistory`, paged through the server's own `nextOffset` so
 * the walk needs no client-side cursor maths.
 *
 * Paging is a plain offset state rather than `useInfiniteQuery`: tRPC v11 only
 * types the infinite hooks when the client is built with
 * `TRPCInfiniteQueryLink`, and `app-provider.tsx` uses a bare `httpBatchLink`.
 * One `useQuery` against a mutable `offset` reaches the same server contract
 * without re-wiring the provider every other client in the app shares.
 *
 * `reason` is rendered as the raw `CreditReason` string. A label map for six
 * reasons is a translation table that goes stale the moment a reason is added;
 * the string is already the vocabulary the database and the API speak.
 */

import { useState } from "react";

import { trpc } from "@/src/lib/trpc/client";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

const PAGE_SIZE = 10;

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function CreditsUsageSection() {
  const [offset, setOffset] = useState(0);

  const balance = trpc.project.getCredits.useQuery(undefined, {
    staleTime: 60_000,
  });
  const history = trpc.user.getCreditHistory.useQuery(
    { limit: PAGE_SIZE, offset },
    { placeholderData: (previous) => previous },
  );

  const entries = history.data?.items ?? [];
  const nextOffset = history.data?.nextOffset ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credits &amp; Usage</CardTitle>
        <CardDescription>
          Every grant and spend on your account, newest first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">
            {balance.data ?? 0}
          </span>
          <span className="text-muted-foreground text-sm">
            credits available
          </span>
        </div>

        {history.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No credit activity yet.
          </p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 py-2"
              >
                <div className="flex flex-col">
                  <Badge variant="secondary" className="w-fit font-mono">
                    {entry.reason}
                  </Badge>
                  <span className="text-muted-foreground mt-1 text-xs">
                    {dateFormat.format(new Date(entry.createdAt))}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={
                      entry.delta >= 0
                        ? "font-medium tabular-nums"
                        : "text-destructive font-medium tabular-nums"
                    }
                  >
                    {entry.delta >= 0 ? "+" : ""}
                    {entry.delta}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    balance {entry.balanceAfter}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(nextOffset !== null || offset > 0) && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || history.isFetching}
            >
              Newer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => nextOffset !== null && setOffset(nextOffset)}
              disabled={nextOffset === null || history.isFetching}
            >
              Older
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
