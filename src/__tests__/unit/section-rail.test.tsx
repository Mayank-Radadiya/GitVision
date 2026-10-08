import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SectionRail from "@/src/features/projects/components/project-view/rail/section-rail";
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
  useProjectInsights: () => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: { loading: vi.fn(), dismiss: vi.fn(), error: vi.fn() },
}));

vi.mock(
  "@/src/features/projects/components/project-view/project-header",
  () => ({
    default: () => <div>header</div>,
  }),
);
vi.mock("@/src/features/projects/components/project-view/overview", () => ({
  default: () => <div>overview</div>,
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

const TAB_NAMES = [
  "Overview",
  "Issues",
  "Pull Requests",
  "Files",
  "Contributors",
  "Commits",
  "Settings",
];

describe("section rail", () => {
  it("is a tablist whose tabs each point at a panel", () => {
    render(<SectionRail activeTab="overview" onTabChange={vi.fn()} />);

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

  // `aria-orientation` describes the layout that was rendered, and the same
  // component renders as a vertical rail at `lg` and a horizontal pill row below
  // it — so it has to be asserted in both, not assumed from the markup.
  it("reports the orientation it is actually rendered in", () => {
    // jsdom's default innerWidth is 1024, which is exactly Tailwind's `lg`.
    render(<SectionRail activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tablist")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });

  it("flips to horizontal below the lg breakpoint", () => {
    window.innerWidth = 768;
    try {
      render(<SectionRail activeTab="overview" onTabChange={vi.fn()} />);
      expect(screen.getByRole("tablist")).toHaveAttribute(
        "aria-orientation",
        "horizontal",
      );
    } finally {
      window.innerWidth = 1024;
    }
  });

  it("badges a section with its open count, and hides the badge at zero", () => {
    render(
      <SectionRail
        activeTab="overview"
        onTabChange={vi.fn()}
        counts={{ issues: 12, "pull-requests": 0, files: 240 }}
      />,
    );
    const issues = screen.getByRole("tab", { name: /Issues/ });
    expect(issues).toHaveTextContent("12");
    expect(screen.getByRole("tab", { name: /Pull Requests/ })).not.toHaveTextContent(
      "0",
    );
    // Counts above 99 are clamped, so the badge never widens the rail.
    expect(screen.getByRole("tab", { name: /Files/ })).toHaveTextContent("99+");
  });

  it("uses one tab stop and supports arrow, Home, and End navigation", () => {
    const change = vi.fn();
    render(<SectionRail activeTab="overview" onTabChange={change} />);
    const overview = screen.getByRole("tab", { name: "Overview" });
    expect(overview).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Issues" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    fireEvent.keyDown(overview, { key: "ArrowDown" });
    expect(change).toHaveBeenLastCalledWith("issues");
    expect(screen.getByRole("tab", { name: "Issues" })).toHaveFocus();
    fireEvent.keyDown(overview, { key: "End" });
    expect(change).toHaveBeenLastCalledWith("settings");
    fireEvent.keyDown(overview, { key: "Home" });
    expect(change).toHaveBeenLastCalledWith("overview");
    fireEvent.keyDown(overview, { key: "ArrowUp" });
    expect(change).toHaveBeenLastCalledWith("settings");
  });

  it("navigates with left/right when rendered as the horizontal pill row", () => {
    window.innerWidth = 768;
    try {
      const change = vi.fn();
      render(<SectionRail activeTab="overview" onTabChange={change} />);
      const overview = screen.getByRole("tab", { name: "Overview" });
      fireEvent.keyDown(overview, { key: "ArrowRight" });
      expect(change).toHaveBeenLastCalledWith("issues");
      fireEvent.keyDown(overview, { key: "ArrowLeft" });
      expect(change).toHaveBeenLastCalledWith("settings");
      // The horizontal row must not also answer to the vertical arrows, or a
      // right-arrow keypress would move the selection in two directions at once.
      change.mockClear();
      fireEvent.keyDown(overview, { key: "ArrowDown" });
      expect(change).not.toHaveBeenCalled();
    } finally {
      window.innerWidth = 1024;
    }
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
