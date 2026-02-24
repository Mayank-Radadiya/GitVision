"use client";

/**
 * Quick action shortcuts — "New Project" and other frequent actions.
 * Pure presentational, receives no data hooks.
 */

import { memo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { inngest } from "@/src/lib/inngest/client";
import toast from "react-hot-toast";

function QuickActions() {
  const router = useRouter();

  const handleSetupInngestTest = async () => {
    const res = await inngest.send({
      name: "test/hello.world",
      data: {
        email: "[EMAIL_ADDRESS]",
      },
    });

    // Verify that the event was sent. Give toast success if sent.
    if (res.ids.length > 0) {
      toast.success("Event sent successfully");
    } else {
      toast.error("Failed to send event");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSetupInngestTest}
        className="gap-1.5 rounded-lg text-xs"
        aria-label="Dashboard settings"
      >
        <Settings className="h-3.5 w-3.5" />
        Setup Inngest test
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
