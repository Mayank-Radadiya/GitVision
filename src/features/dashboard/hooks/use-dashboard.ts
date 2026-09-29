import { trpc } from "@/src/lib/trpc/client";

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

export const useCommitChart = () => {
  const { data, ...rest } = useDashboardData();
  return { data: data?.commitChart, ...rest };
};

export const useLanguageBreakdown = () => {
  const { data, ...rest } = useDashboardData();
  return { data: data?.languages, ...rest };
};

export const useNeedsAttention = () => {
  const { data, ...rest } = useDashboardData();
  return { data: data?.attention, ...rest };
};

// ─── Standalone query ────────────────────────────────────────────────────────

/**
 * The credit balance alone. Kept out of the consolidated query on purpose: the
 * sidebar renders on every page and the create-project gauge is the only
 * dashboard read on that page, so neither should pay for `getDashboardData`.
 */
export const useCredits = () =>
  trpc.project.getCredits.useQuery(undefined, {
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: DASHBOARD_GC_TIME,
  });
