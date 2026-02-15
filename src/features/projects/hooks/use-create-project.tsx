/**
 * Create Project — tRPC Mutation Hook
 *
 * Wraps `trpc.project.create.useMutation()` with:
 * - Cache invalidation (dashboard + project list)
 * - Toast notifications (success/error)
 * - Auto-redirect to dashboard on success
 *
 * Replaces the old axios.post("/api/project/createProject") call.
 */

import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { trpc } from "@/src/lib/trpc/client";

export function useCreateProject() {
  const router = useRouter();
  const utils = trpc.useUtils();

  return trpc.project.create.useMutation({
    onSuccess: () => {
      // Show success toast
      toast.success("Repository added successfully!", {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      });

      // Invalidate dashboard and project list caches
      utils.project.getAll.invalidate();
      utils.project.getDashboardInfo.invalidate();
      utils.project.getRecentActivity.invalidate();
      utils.project.getCommitChart.invalidate();

      // Redirect to dashboard
      setTimeout(() => router.push("/dashboard"), 400);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add repository. Please try again.", {
        icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
      });
    },
  });
}
