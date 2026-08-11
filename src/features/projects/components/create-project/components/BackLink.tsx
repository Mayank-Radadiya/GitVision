/**
 * =============================================================================
 * BACK LINK & BREADCRUMB
 * =============================================================================
 */

"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push("/dashboard")}
      className="group inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gv-hairline/60 bg-gv-graphite-2/40 px-3 py-1.5 font-gv-mono text-xs text-gv-fog transition-all duration-200 hover:border-gv-amber/40 hover:bg-gv-graphite-2 hover:text-gv-bone hover:shadow-sm"
    >
      <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-1 text-gv-amber" />
      <span>Back to Projects</span>
    </button>
  );
}
