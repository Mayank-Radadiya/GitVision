"use client";

/**
 * Quick action shortcuts — "New Project" and other frequent actions.
 * Pure presentational, receives no data hooks.
 */

import { memo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

function QuickActions() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push("/dashboard/settings")}
        className="gap-1.5 rounded-lg text-xs"
        aria-label="Dashboard settings"
      >
        <Settings className="h-3.5 w-3.5" />
        Settings
      </Button>
      <Button
        size="sm"
        onClick={() => router.push("/dashboard/create-project")}
        className="gap-1.5 rounded-lg text-xs shadow-md shadow-primary/20"
        aria-label="Create new project"
      >
        <Plus className="h-3.5 w-3.5" />
        New Project
      </Button>
    </div>
  );
}

export default memo(QuickActions);
