import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectActionController } from "@/features/projects/components/project-view/project-actions";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  invalidate: vi.fn(),
  cancelQueries: vi.fn(),
  removeQueries: vi.fn(),
  chat: vi.fn(),
  sync: vi.fn(),
  remove: vi.fn(),
  options: {} as Record<
    string,
    {
      retry?: boolean;
      onSuccess: (data: { id: string }) => void | Promise<void>;
      onError: (error: { message: string }) => void;
      onSettled: () => void;
    }
  >,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, refresh: h.refresh }),
}));
vi.mock("react-hot-toast", () => ({
  default: { success: h.success, error: h.error },
}));
vi.mock("@/src/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      project: {
        getDetails: { invalidate: h.invalidate },
        getAll: { invalidate: h.invalidate },
        getDashboardData: { invalidate: h.invalidate },
      },
    }),
    project: {
      delete: {
        useMutation: (options: typeof h.options.remove) => {
          h.options.remove = options;
          return { mutate: h.remove, isPending: false };
        },
      },
      resync: {
        useMutation: (options: typeof h.options.sync) => {
          h.options.sync = options;
          return { mutate: h.sync, isPending: false };
        },
      },
    },
    chat: {
      create: {
        useMutation: (options: typeof h.options.chat) => {
          h.options.chat = options;
          return { mutate: h.chat, isPending: false };
        },
      },
    },
  },
}));
beforeEach(() => vi.clearAllMocks());

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Render against a real QueryClient and report what reached it.
 *
 * The purge assertions below are about cache *effect*, not about whether
 * `cancelQueries` was called — so they read the cache rather than the spy.
 * A spy would still pass if the predicate matched nothing.
 */
function render() {
  const client = new QueryClient();
  const result = renderHook(
    () => useProjectActionController("p1", "completed"),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  return { ...result, client };
}

/** A tRPC query key, in the shape `getQueryKeyInternal` builds. */
function keyFor(
  procedure: string,
  input?: unknown,
): readonly unknown[] {
  return [["project", procedure], input === undefined ? {} : { input }];
}

describe("shared project actions", () => {
  it("creates a project chat once and navigates using the returned chat ID", () => {
    const { result } = renderHook(
      () => useProjectActionController("project-1", "completed"),
      { wrapper },
    );
    act(() => {
      result.current.askAI();
      result.current.askAI();
    });
    expect(h.chat).toHaveBeenCalledExactlyOnceWith({
      type: "project",
      projectId: "project-1",
    });
    expect(h.push).not.toHaveBeenCalled();
    act(() => h.options.chat.onSuccess({ id: "chat-2" }));
    expect(h.push).toHaveBeenCalledWith("/chat/chat-2");
  });
  it("allows a partial index but refuses to create a chat for failed indexing", () => {
    const { result, rerender } = renderHook(
      ({ status }) => useProjectActionController("p1", status),
      { initialProps: { status: "failed" }, wrapper },
    );
    act(() => result.current.askAI());
    expect(h.chat).not.toHaveBeenCalled();
    rerender({ status: "partial" });
    act(() => result.current.askAI());
    expect(h.chat).toHaveBeenCalledOnce();
  });
  it("reports chat creation failures and releases the lock for retry", () => {
    const { result } = renderHook(
      () => useProjectActionController("p1", "completed"),
      { wrapper },
    );
    act(() => result.current.askAI());
    act(() => {
      h.options.chat.onError({ message: "Try later" });
      h.options.chat.onSettled();
    });
    expect(h.error).toHaveBeenCalledWith("Try later");
    expect(h.push).not.toHaveBeenCalled();
    act(() => result.current.askAI());
    expect(h.chat).toHaveBeenCalledTimes(2);
  });
  it("queues sync once and reports queueing rather than completion", () => {
    const { result } = renderHook(
      () => useProjectActionController("p1", "completed"),
      { wrapper },
    );
    act(() => {
      result.current.syncProject();
      result.current.syncProject();
    });
    expect(h.sync).toHaveBeenCalledExactlyOnceWith({ projectId: "p1" });
    act(() => h.options.sync.onSuccess({ id: "unused" }));
    expect(h.invalidate).toHaveBeenCalledWith({ projectId: "p1" });
    expect(h.success).toHaveBeenCalledWith(
      "File sync queued. It runs in the background.",
    );
  });
  it("requests confirmation before deleting and retains it on failure", () => {
    const { result } = renderHook(
      () => useProjectActionController("p1", "completed"),
      { wrapper },
    );
    act(() => result.current.requestDelete());
    expect(result.current.deleteOpen).toBe(true);
    expect(h.remove).not.toHaveBeenCalled();
    act(() => {
      result.current.confirmDelete();
      result.current.confirmDelete();
    });
    expect(h.remove).toHaveBeenCalledExactlyOnceWith({ projectId: "p1" });
    act(() => {
      h.options.remove.onError({ message: "Deletion failed" });
      h.options.remove.onSettled();
    });
    expect(result.current.deleteOpen).toBe(true);
    expect(h.push).not.toHaveBeenCalled();
    act(() => result.current.confirmDelete());
    expect(h.remove).toHaveBeenCalledTimes(2);
  });
});

describe("deleting a project purges its cache before navigating", () => {
  it("drops every cached query scoped to the deleted project", async () => {
    const { result, client } = render();
    client.setQueryData(keyFor("getDetails", { projectId: "p1" }), {
      projectId: "p1",
    });
    client.setQueryData(keyFor("getInsights", { projectId: "p1", days: 30 }), {
      work: {},
    });
    client.setQueryData(
      keyFor("getCommits", { projectId: "p1", limit: 10 }),
      { pages: [] },
    );

    await act(async () => {
      result.current.confirmDelete();
      await h.options.remove.onSuccess({ id: "p1" });
    });

    expect(client.getQueryData(keyFor("getDetails", { projectId: "p1" }))).toBe(
      undefined,
    );
    expect(
      client.getQueryData(keyFor("getInsights", { projectId: "p1", days: 30 })),
    ).toBeUndefined();
    expect(
      client.getQueryData(keyFor("getCommits", { projectId: "p1", limit: 10 })),
    ).toBeUndefined();
  });

  it("leaves other projects' caches and the shared project lists alone", async () => {
    const { result, client } = render();
    client.setQueryData(keyFor("getDetails", { projectId: "other" }), {
      projectId: "other",
    });
    client.setQueryData(keyFor("getDashboardData"), { projects: [] });
    client.setQueryData(keyFor("getAll"), ["a", "b"]);

    await act(async () => {
      result.current.confirmDelete();
      await h.options.remove.onSuccess({ id: "p1" });
    });

    expect(
      client.getQueryData(keyFor("getDetails", { projectId: "other" })),
    ).toEqual({ projectId: "other" });
    expect(client.getQueryData(keyFor("getDashboardData"))).toEqual({
      projects: [],
    });
    expect(client.getQueryData(keyFor("getAll"))).toEqual(["a", "b"]);
  });

  it("purges before it navigates, so the poll never outlives the row", async () => {
    // The regression this exists for: the `getDetails` observer carries a
    // `refetchInterval`. Purging after `router.push` left it polling a project
    // that no longer existed, at five requests per tick once retries counted.
    const { result, client } = render();
    client.setQueryData(keyFor("getDetails", { projectId: "p1" }), {
      projectId: "p1",
      embeddingStatus: "processing",
    });

    let purgedWhenPushHappened: boolean | null = null;
    h.push.mockImplementation(() => {
      purgedWhenPushHappened =
        client.getQueryData(keyFor("getDetails", { projectId: "p1" })) ===
        undefined;
    });

    await act(async () => {
      result.current.confirmDelete();
      await h.options.remove.onSuccess({ id: "p1" });
    });

    expect(h.push).toHaveBeenCalledWith("/dashboard");
    expect(purgedWhenPushHappened).toBe(true);
  });

  it("does not retry the delete itself", () => {
    render();
    // A timed-out delete retried against an already-deleted row reports a
    // failure for work that succeeded.
    expect(h.options.remove.retry).toBe(false);
  });
});
