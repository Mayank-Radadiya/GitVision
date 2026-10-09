import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectCard from "@/src/features/dashboard/components/project-list/project-card";
import CodeViewerProjectGrid from "@/src/features/projects/components/code-viewer-project-grid";
import CommitsTab from "@/src/features/projects/components/project-view/tab-content/commits-tab";
import type { Commit } from "@/src/features/projects/types/project.types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ projectId: "p1" }),
}));

vi.mock("@/src/lib/trpc/client", () => ({
  trpc: {
    project: {
      getAll: {
        useQuery: () => ({
          data: [
            {
              id: "p1",
              projectName: "demo",
              githubUrl: "https://github.com/acme/demo",
              star: 1,
              forks: 2,
              totalCommits: 3,
              totalContributors: 4,
              createdAt: new Date(),
            },
          ],
          isLoading: false,
        }),
      },
    },
  },
}));

vi.mock("@/features/projects/hooks/use-project", () => ({
  useProjectCommits: () => ({
    data: { pages: [{ commits: [commit], nextCursor: undefined }] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }),
  useGenerateAiSummary: () => ({ mutate: vi.fn() }),
}));

const commit: Commit = {
  id: "c1",
  commitHash: "abc1234def",
  commitMessage: "Add dark mode support",
  aiSummary: null,
  authorName: "Ada",
  authorEmail: "ada@example.com",
  authorAvatar: null,
  authorDate: new Date(),
  committerName: "Ada",
  committerEmail: "ada@example.com",
  committerDate: new Date(),
  projectId: "p1",
  createdAt: new Date(),
};

describe("project card", () => {
  it("is a link that does not swallow the repository link", () => {
    render(
      <ProjectCard
        id="p1"
        projectName="demo"
        githubUrl="https://github.com/acme/demo"
        star={1}
        forks={2}
        totalCommits={3}
        totalContributors={4}
        createdAt={new Date()}
        index={0}
      />,
    );

    const card = screen.getByRole("link", { name: "demo" });
    expect(card).toHaveAttribute("href", "/dashboard/user-project/p1");

    const repo = screen.getByRole("link", { name: /on GitHub/ });
    expect(card.contains(repo)).toBe(false);
    expect(repo).toHaveAttribute("href", "https://github.com/acme/demo");
  });
});

describe("code viewer project grid", () => {
  it("is a single row link with the repo path as plain text", () => {
    render(<CodeViewerProjectGrid />);

    const row = screen.getByRole("link", { name: /demo/ });
    expect(row).toHaveAttribute("href", "/code-viewer/p1");

    // The repo path renders as text inside the row, not a nested link.
    expect(
      screen.queryByRole("link", { name: "acme/demo" }),
    ).not.toBeInTheDocument();
    expect(row.textContent).toContain("acme/demo");
  });
});

describe("commit row", () => {
  it("toggles from a real button that wraps only the message", () => {
    render(<CommitsTab />);

    const toggle = screen.getByRole("button", { name: "Add dark mode support" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.textContent).not.toContain("Ada");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      document.getElementById(toggle.getAttribute("aria-controls") as string),
    ).not.toBeNull();
  });
});
