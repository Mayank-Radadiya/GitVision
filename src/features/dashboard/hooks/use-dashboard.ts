/**
 * Hooks for dashboard data fetching.
 * Each hook subscribes to a single tRPC query to minimize rerender scope.
 * staleTime prevents re-fetching hydrated data from the server.
 */

import { trpc } from "@/src/lib/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const DASHBOARD_STALE_TIME = 60_000; // 60s — hydrated data stays fresh

/** Dashboard aggregate stats (projects, commits, files, credits) */
export const useDashboardInfo = () => {
  return trpc.project.getDashboardInfo.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
  });
};

/** All user projects — used by project list + search */
export const useUserProjects = () => {
  return trpc.project.getAll.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
  });
};

/** Recent commit activity across all projects */
export const useRecentActivity = () => {
  return trpc.project.getRecentActivity.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
  });
};

/** Daily commit counts for the chart (last 7 days) */
export const useCommitChart = () => {
  return trpc.project.getCommitChart.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
  });
};

/** Create project mutation with cache invalidation */
export const useCreateProject = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return trpc.project.create.useMutation({
    onSuccess: () => {
      toast.success("Project created successfully");
      router.push("/dashboard");

      // Invalidate all dashboard queries so data refreshes
      queryClient.invalidateQueries({
        queryKey: [["project"]],
      });
    },
    onError: (error) => {
      toast.error(`Error creating project: ${error.message}`);
    },
  });
};
