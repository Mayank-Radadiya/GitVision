import { trpc } from "@/src/lib/trpc/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const DASHBOARD_STALE_TIME = 60_000; // 60s — hydrated data stays fresh
const DASHBOARD_GC_TIME = 5 * 60_000; // 5min — keep in cache for quick revisits

// ─── Core consolidated query ──────────────────────────────────────────────────

/**
 * Single query that loads ALL dashboard data.
 * All derived hooks project from this one query — no extra HTTP calls.
 */
const useDashboardData = () =>
  trpc.project.getDashboardData.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
  });

// ─── Derived hooks (each projects a slice of the consolidated data) ───────────

export const useDashboardInfo = () => {
  const { data, ...rest } = useDashboardData();
  return { data: data?.stats, ...rest };
};

export const useUserProjects = () => {
  const { data, ...rest } = useDashboardData();
  return { data: data?.projects, ...rest };
};

export const useRecentActivity = () => {
  const { data, ...rest } = useDashboardData();
  return { data: data?.recentActivity, ...rest };
};

export const useCommitChart = () => {
  const { data, ...rest } = useDashboardData();
  return { data: data?.commitChart, ...rest };
};

export const usePickUpWhereYouLeftOff = () => {
  const { data, ...rest } = useDashboardData();
  return { data: data?.pickUp, ...rest };
};

export const useLanguageBreakdown = () => {
  const { data, ...rest } = useDashboardData();
  return { data: data?.languages, ...rest };
};

export const useNeedsAttention = () => {
  const { data, ...rest } = useDashboardData();
  return { data: data?.attention, ...rest };
};

// ─── Mutations (unchanged) ──────────────────────────────────────────────────

export const useCreateProject = () => {
  const router = useRouter();
  const utils = trpc.useUtils();

  return trpc.project.create.useMutation({
    onSuccess: () => {
      toast.success("Project created successfully");

      // Invalidate the consolidated query — refreshes everything
      utils.project.getDashboardData.invalidate();

      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(`Error creating project: ${error.message}`);
    },
  });
};
