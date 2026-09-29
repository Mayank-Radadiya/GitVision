import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectTabs from "@/src/features/projects/components/project-view/project-tabs";
import ProjectPage from "@/src/features/projects/components/project-view/project-page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "p1" }),
}));

vi.mock("@/src/features/projects/hooks/use-project", () => ({
  useProjectDetails: () => ({
    data: {
      projectName: "demo",
      githubUrl: "https://github.com/acme/demo",
      star: 1,
      fork: 1,
      totalCommits: 1,
      totalContributors: 1,
      totalBranches: 1,
      languages: [],
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useProjectCommits: () => ({ data: { pages: [{ commits: [] }] } }),
}));

vi.mock("react-hot-toast", () => ({
  default: { loading: vi.fn(), dismiss: vi.fn(), error: vi.fn() },
}));

vi.mock("@/src/features/projects/components/project-view/project-header", () => ({
  default: () => <div>header</div>,
}));
vi.mock("@/src/features/projects/components/project-view/bento-grid", () => ({
  default: () => <div>overview grid</div>,
  BentoCard: () => <div />,
}));
vi.mock("@/src/features/projects/components/project-view/code-viewer", () => ({
  default: () => <div>code viewer</div>,
}));
vi.mock(
  "@/src/features/projects/components/project-view/tab-content/commits-tab",
  () => ({ default: () => <div>commits</div> }),
);
vi.mock(
  "@/src/features/projects/components/project-view/tab-content/pr-tab",
  () => ({ default: () => <div>pull requests</div> }),
);
vi.mock(
  "@/src/features/projects/components/project-view/tab-content/issues-tab",
  () => ({ default: () => <div>issues</div> }),
);

const TAB_NAMES = ["Overview", "Commits", "Pull Requests", "Issues"];

describe("project tabs", () => {
  it("is a tablist whose tabs each point at a panel", () => {
    render(<ProjectTabs activeTab="overview" onTabChange={vi.fn()} />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(TAB_NAMES.length);

    for (const tab of tabs) {
      expect(tab).toHaveAttribute("id");
      expect(tab.getAttribute("aria-controls")).toBeTruthy();
    }
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /Commits/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it.each(TAB_NAMES)("renders the %s panel labelled by its tab", (name) => {
    render(<ProjectPage />);

    const tab = screen.getByRole("tab", { name: new RegExp(name) });
    fireEvent.click(tab);

    const panel = document.getElementById(
      tab.getAttribute("aria-controls") as string,
    );
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("role", "tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", tab.getAttribute("id"));
  });
});
