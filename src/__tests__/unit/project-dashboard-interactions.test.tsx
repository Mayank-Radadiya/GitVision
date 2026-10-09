import {
  fireEvent,
  render,
  screen,
  within,
  cleanup,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OverviewDashboard,
  type OverviewDashboardProps,
} from "@/features/projects/components/project-view/overview";
import { Composition } from "@/features/projects/components/project-view/overview/composition";
import SectionRail from "@/features/projects/components/project-view/rail/section-rail";
import type { LanguageEntry } from "@/db/schema";

// ResizeObserver is a browser API; geometry itself has separate unit coverage.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);
afterEach(cleanup);
const props: OverviewDashboardProps = {
  insights: undefined,
  isInsightsLoading: false,
  isInsightsFetching: false,
  window: 30,
  onWindowChange: vi.fn(),
  embeddingStatus: "completed",
  indexedFileCount: 10,
  totalFileCount: 10,
  totalFiles: 10,
  totalCommits: 200,
  totalContributors: 4,
  languages: [],
  briefing: {
    summary: "A repository summary.",
    description: "",
    techStack: [],
    keyComponents: [],
    architecture: "",
  },
};

const insights = {
  days: 30,
  series: [{ date: "2026-10-08", commits: 4 }],
  priorSeries: [{ date: "2026-09-08", commits: 2 }],
  totals: { commitsInWindow: 4, priorWindowCommits: 2, activeDays: 1 },
  work: {
    openIssues: 3,
    closedIssues: 7,
    openPullRequests: 2,
    mergedPullRequests: 9,
    medianOpenAgeDays: 4,
    openAgeBuckets: { fresh: 5, aging: 0, stale: 0, dormant: 0 },
  },
  contributors: [],
  recentCommits: [],
};

describe("project dashboard data and navigation", () => {
  it("preserves repository details on insight failure without reporting unknown counts as zero", () => {
    const retry = vi.fn();
    render(
      <OverviewDashboard {...props} insightsError onRetryInsights={retry} />,
    );
    expect(
      screen.getByText(/200 repository commits reported by GitHub/),
    ).toBeVisible();
    expect(screen.getByText("A repository summary.")).toBeVisible();
    expect(screen.getByText("100%")).toBeVisible();
    const metrics = screen.getByLabelText("Project metrics");
    expect(within(metrics).getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText("No open work")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("keeps prior period data accurately labelled while a different period is loading", () => {
    render(
      <OverviewDashboard
        {...props}
        insights={insights}
        window={7}
        isPlaceholderData
        isInsightsFetching
      />,
    );
    expect(screen.getByRole("button", { name: "7d" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Previous 30 days")).toBeVisible();
    expect(screen.getByText("commits / 30d")).toBeVisible();
    expect(screen.queryByText("commits this week")).not.toBeInTheDocument();
  });

  it("opens the correct detail section from each operational metric", () => {
    const navigate = vi.fn();
    render(
      <OverviewDashboard
        {...props}
        insights={insights}
        onNavigate={navigate}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Open pull requests: 2/ }),
    );
    expect(navigate).toHaveBeenLastCalledWith("pull-requests");
    fireEvent.click(screen.getByRole("button", { name: /Open issues: 3/ }));
    expect(navigate).toHaveBeenLastCalledWith("issues");
    fireEvent.click(
      screen.getByRole("button", { name: /Searchable files: 10/ }),
    );
    expect(navigate).toHaveBeenLastCalledWith("files");
  });

  it("does not lose omitted languages from the composition denominator", () => {
    const languages: LanguageEntry[] = Array.from({ length: 6 }, (_, i) => ({
      name: `Language ${i}`,
      size: 100,
      color: "#888888",
      percentage: 100 / 6,
    }));
    render(<Composition languages={languages} />);
    const bar = screen.getByRole("img");
    expect(bar.children).toHaveLength(6);
    const totalWidth = Array.from(bar.children).reduce(
      (sum, node) => sum + parseFloat((node as HTMLElement).style.width),
      0,
    );
    expect(totalWidth).toBeCloseTo(100);
    expect(screen.queryByText("Language 5")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /more languages/ }));
    expect(screen.getByText("Language 5")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Show fewer languages" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("supports keyboard section navigation with roving tab stops", () => {
    const navigate = vi.fn();
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    const { rerender } = render(
      <SectionRail activeTab="overview" onTabChange={navigate} />,
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "Overview" }), {
      key: "ArrowRight",
    });
    expect(navigate).toHaveBeenLastCalledWith("commits");
    rerender(<SectionRail activeTab="issues" onTabChange={navigate} />);
    expect(screen.getByRole("tab", { name: "Issues" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "Issues" }), {
      key: "End",
    });
    expect(navigate).toHaveBeenLastCalledWith("settings");
    expect(scroll).toHaveBeenCalled();
  });
  it("uses all repository files rather than the considered subset for searchable coverage", () => {
    render(
      <OverviewDashboard
        {...props}
        insights={insights}
        indexedFileCount={384}
        totalFileCount={400}
        totalFiles={428}
      />,
    );
    expect(screen.getByText("of 428 repository files")).toBeVisible();
    expect(
      screen.queryByText("of 400 repository files"),
    ).not.toBeInTheDocument();
  });
});
