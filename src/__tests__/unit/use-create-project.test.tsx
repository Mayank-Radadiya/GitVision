import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCreateProject } from "@/features/projects/hooks/use-create-project";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  invalidate: vi.fn(),
  mutate: vi.fn(),
  mutationOpts: undefined as
    | {
        onSuccess?: () => void;
        onError?: (e: { message: string }) => void;
      }
    | undefined,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/src/lib/trpc/client", () => ({
  trpc: {
    project: {
      create: {
        useMutation: (opts: NonNullable<typeof h.mutationOpts>) => {
          h.mutationOpts = opts;
          return { mutate: h.mutate, isPending: false };
        },
      },
    },
    useUtils: () => ({
      project: new Proxy(
        {},
        {
          get: (_t, proc: string) => ({ invalidate: () => h.invalidate(proc) }),
        },
      ),
    }),
  },
}));

describe("useCreateProject", () => {
  beforeEach(() => {
    h.invalidate.mockClear();
    h.mutationOpts = undefined;
  });

  it("invalidates getDashboardData, the query the dashboard hooks actually read", () => {
    renderHook(() => useCreateProject());

    h.mutationOpts?.onSuccess?.();

    // Every dashboard hook (useUserProjects, useRecentActivity, useCommitChart,
    // useDashboardInfo, ...) is a projection of this one query, so invalidating
    // anything else leaves the dashboard stale.
    expect(h.invalidate).toHaveBeenCalledWith("getDashboardData");
    expect(h.invalidate).toHaveBeenCalledWith("getAll");
  });
});
