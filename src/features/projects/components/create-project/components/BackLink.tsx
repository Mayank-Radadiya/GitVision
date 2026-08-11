/**
 * =============================================================================
 * BACK LINK — plain text, no box (brief §5.1)
 * =============================================================================
 */

"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push("/dashboard")}
      className="group inline-flex cursor-pointer items-center gap-1.5 font-gv-body text-sm text-gv-fog transition-colors duration-150 hover:text-gv-bone"
    >
      <ChevronLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
      <span className="relative">
        Back to Dashboard
        {/* underline draws left→right on hover (150ms) */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-current transition-transform duration-150 group-hover:scale-x-100"
        />
      </span>
    </button>
  );
}
