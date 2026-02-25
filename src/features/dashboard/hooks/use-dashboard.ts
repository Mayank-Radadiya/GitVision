import { trpc } from "@/src/lib/trpc/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const DASHBOARD_STALE_TIME = 60_000; // 60s — hydrated data stays fresh

export const useDashboardInfo = () => {
  return trpc.project.getDashboardInfo.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
  });
};

export const useUserProjects = () => {
  return trpc.project.getAll.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
  });
};

// Now accepts an optional limit parameter!
export const useRecentActivity = (limit?: number) => {
  return trpc.project.getRecentActivity.useQuery(
    limit ? { limit } : undefined,
    { staleTime: DASHBOARD_STALE_TIME },
  );
};

// Now accepts an optional days parameter!
export const useCommitChart = (days?: number) => {
  return trpc.project.getCommitChart.useQuery(days ? { days } : undefined, {
    staleTime: DASHBOARD_STALE_TIME,
  });
};

export const useCreateProject = () => {
  const router = useRouter();
  const utils = trpc.useUtils();

  return trpc.project.create.useMutation({
    onSuccess: () => {
      toast.success("Project created successfully");

      // Type-safe cache invalidation. This guarantees you wipe the exact queries.
      // We invalidate the dashboard stats and the project list.
      utils.project.getDashboardInfo.invalidate();
      utils.project.getAll.invalidate();
      utils.project.getRecentActivity.invalidate();

      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(`Error creating project: ${error.message}`);
    },
  });
};

export const usePickUpWhereYouLeftOff = () => {
  return trpc.project.getPickUpWhereYouLeftOff.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
  });
};

export const useLanguageBreakdown = () => {
  return trpc.project.getLanguageBreakdown.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
  });
};

export const useNeedsAttention = () => {
  return trpc.project.getNeedsAttention.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
  });
};
