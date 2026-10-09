import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectActionController } from "@/features/projects/components/project-view/project-actions";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  invalidate: vi.fn(),
  chat: vi.fn(),
  sync: vi.fn(),
  remove: vi.fn(),
  options: {} as Record<
    string,
    {
      onSuccess: (data: { id: string }) => void;
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

describe("shared project actions", () => {
  it("creates a project chat once and navigates using the returned chat ID", () => {
    const { result } = renderHook(() =>
      useProjectActionController("project-1", "completed"),
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
      { initialProps: { status: "failed" } },
    );
    act(() => result.current.askAI());
    expect(h.chat).not.toHaveBeenCalled();
    rerender({ status: "partial" });
    act(() => result.current.askAI());
    expect(h.chat).toHaveBeenCalledOnce();
  });
  it("reports chat creation failures and releases the lock for retry", () => {
    const { result } = renderHook(() =>
      useProjectActionController("p1", "completed"),
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
    const { result } = renderHook(() =>
      useProjectActionController("p1", "completed"),
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
    const { result } = renderHook(() =>
      useProjectActionController("p1", "completed"),
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
