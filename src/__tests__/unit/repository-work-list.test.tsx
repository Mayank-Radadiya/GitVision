import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RepositoryWorkList from "@/features/projects/components/project-view/tab-content/repository-work-list";

const h = vi.hoisted(() => ({
  refetch: vi.fn(),
  commentRetry: vi.fn(),
  comments: vi.fn(),
  sync: vi.fn(),
  page: vi.fn(),
  error: false,
  commentError: false,
  items: [
    {
      id: "i1",
      title: "Improve navigation",
      issueNumber: 42,
      state: "open",
      authorLogin: "ada",
      authorAvatar: null,
      githubUpdatedAt: new Date("2026-10-08T12:00:00Z"),
      githubCreatedAt: null,
    },
  ],
}));
vi.mock("@/features/projects/hooks/use-project", () => ({
  usePaginatedProjectIssues: () => ({
    data: { pages: [{ items: h.items }] },
    isLoading: false,
    isError: h.error,
    isFetching: false,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: h.page,
    refetch: h.refetch,
  }),
  useIssueComments: (id: string) => {
    h.comments(id);
    return {
      data: h.commentError ? undefined : { comments: [], hasMore: false },
      isLoading: false,
      isError: h.commentError,
      refetch: h.commentRetry,
    };
  },
  useSyncIssues: () => ({ mutate: h.sync, isPending: false }),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  h.error = false;
  h.commentError = false;
});
const props = { projectId: "p1", repoUrl: "https://github.com/acme/demo" };

describe("repository work interactions", () => {
  it("loads discussion only after disclosure and keeps GitHub links independent", () => {
    render(<RepositoryWorkList {...props} isPullRequest={false} />);
    expect(h.comments).not.toHaveBeenCalled();
    const link = screen.getByRole("link", { name: "View issue 42 on GitHub" });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/acme/demo/issues/42",
    );
    const toggle = screen.getByRole("button", { name: "Improve navigation" });
    expect(toggle.contains(link)).toBe(false);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(h.comments).toHaveBeenCalledWith("i1");
  });
  it("offers a discussion retry instead of reporting no comments on failure", () => {
    h.commentError = true;
    render(<RepositoryWorkList {...props} isPullRequest={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Improve navigation" }));
    expect(screen.queryByText(/No comments/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.commentRetry).toHaveBeenCalledOnce();
  });
  it("resets a filtered empty state and retains pagination", () => {
    render(<RepositoryWorkList {...props} isPullRequest />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search pull requests" }),
      { target: { value: "missing" } },
    );
    expect(screen.getByText("No matching pull requests")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(
      screen.getByRole("button", { name: "Improve navigation" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(h.page).toHaveBeenCalledOnce();
  });
  it("retains usable rows on refresh failure", () => {
    h.error = true;
    render(<RepositoryWorkList {...props} isPullRequest={false} />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Improve navigation" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.refetch).toHaveBeenCalledOnce();
  });
});
