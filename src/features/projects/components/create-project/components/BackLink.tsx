/**
 * =============================================================================
 * BACK LINK — Quiet Ghost Link
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
      className="group inline-flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 font-gv-mono text-xs text-gv-fog transition-colors duration-200 hover:text-gv-bone"
    >
      <ArrowLeft className="h-3.5 w-3.5 text-gv-fog transition-all duration-200 group-hover:-translate-x-0.5 group-hover:text-gv-amber" />
      <span>Back to Projects</span>
    </button>
  );
}