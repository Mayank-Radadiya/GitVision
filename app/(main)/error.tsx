"use client";

import { AlertOctagon, RefreshCw, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error boundary caught error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8 min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-6 bg-card/60 border border-border/40 p-8 rounded-2xl backdrop-blur-xl shadow-lg">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500">
          <AlertOctagon className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Dashboard Error
          </h2>
          <p className="text-sm text-muted-foreground">
            {error.message || "Something went wrong while displaying this workspace section."}
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-md cursor-pointer"
            aria-label="Reload dashboard view"
          >
            <RefreshCw className="w-4 h-4" />
            Reload View
          </button>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/60 bg-background hover:bg-muted text-foreground font-medium text-sm transition-colors cursor-pointer"
            aria-label="Return to Dashboard"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
