"use client";

/**
 * Quick action — premium "New Project" CTA button.
 */

import { memo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

function QuickActions() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/create-project")}
      className="group bg-primary text-primary-foreground shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/30 relative inline-flex cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
      aria-label="Create new project"
    >
      <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
      New Project
    </button>
  );
}

export default memo(QuickActions);
