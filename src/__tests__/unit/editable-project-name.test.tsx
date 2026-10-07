import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditableProjectName from "@/src/features/projects/components/project-view/editable-project-name";

const state = vi.hoisted(() => ({
  data: { projectName: "Original" },
  options: {} as Record<string, (...args: any[]) => any>,
  mutateAsync: vi.fn(),
  cancel: vi.fn(),
  invalidate: vi.fn(),
  toast: Object.assign(vi.fn(), { dismiss: vi.fn(), success: vi.fn(), error: vi.fn() }),
}));
vi.mock("react-hot-toast", () => ({ default: state.toast }));
vi.mock("@/src/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ project: {
      getDetails: { cancel: state.cancel, getData: () => state.data, setData: (_input: unknown, updater: any) => { state.data = typeof updater === "function" ? updater(state.data) : updater; }, invalidate: state.invalidate },
      getAll: { invalidate: state.invalidate }, getDashboardData: { invalidate: state.invalidate },
    } }),
    project: { rename: { useMutation: (options: typeof state.options) => { state.options = options; return { isPending: false, mutateAsync: state.mutateAsync }; } } },
  },
}));
const projectId = "22222222-2222-4222-8222-222222222222";

function edit(value: string) {
  fireEvent.click(screen.getByRole("button", { name: "Rename project Original" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Save project name" }));
}

describe("inline project name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.data = { projectName: "Original" };
    state.mutateAsync.mockImplementation(async (input) => {
      await state.options.onMutate(input);
      state.options.onSettled();
      return input;
    });
  });

  it("updates optimistically and Undo persists the previous name", async () => {
    render(<EditableProjectName projectId={projectId} name="Original" />);
    edit("New name");
    await waitFor(() => expect(state.toast).toHaveBeenCalled());
    expect(state.data.projectName).toBe("New name");
    const notification = state.toast.mock.calls[0][0];
    render(notification({ id: "rename-toast" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(state.mutateAsync).toHaveBeenLastCalledWith({ projectId, projectName: "Original" }));
    expect(state.data.projectName).toBe("Original");
  });

  it("restores cached data and keeps the error visible on failure", async () => {
    state.mutateAsync.mockImplementation(async (input) => {
      const context = await state.options.onMutate(input);
      const error = new Error("Rename failed");
      state.options.onError(error, input, context);
      state.options.onSettled();
      throw error;
    });
    render(<EditableProjectName projectId={projectId} name="Original" />);
    edit("New name");
    expect(await screen.findByRole("alert")).toHaveTextContent("Rename failed");
    expect(state.data.projectName).toBe("Original");
    expect(screen.getByRole("textbox", { name: "Project name" })).toBeVisible();
  });

  it("cancels with Escape without a server mutation", () => {
    render(<EditableProjectName projectId={projectId} name="Original" />);
    fireEvent.click(screen.getByRole("button", { name: "Rename project Original" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Project name" }), { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(state.mutateAsync).not.toHaveBeenCalled();
  });
});
