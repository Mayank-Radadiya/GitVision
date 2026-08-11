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
      className="group font-gv-mono text-gv-fog hover:text-gv-bone inline-flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs transition-colors duration-200"
    >
      <ArrowLeft className="text-gv-fog group-hover:text-gv-amber h-3.5 w-3.5 transition-all duration-200 group-hover:-translate-x-0.5" />
      <span>Back to Projects</span>
    </button>
  );
}
