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
      className="group relative inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
      aria-label="Create new project"
    >
      <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
      New Project
    </button>
  );
}

export default memo(QuickActions);
