import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityChart } from "@/features/projects/components/project-view/charts/activity-chart";
const series = [
  { date: "2026-10-01", commits: 0 },
  { date: "2026-10-02", commits: 12 },
  { date: "2026-10-03", commits: 6 },
];
afterEach(cleanup);
describe("daily activity chart", () => {
  it("renders discrete counts within the plot and includes a separate previous-period line", () => {
    const { container } = render(
      <ActivityChart
        series={series}
        prior={series.map((p) => ({ ...p, commits: 3 }))}
      />,
    );
    const bars = container.querySelectorAll("rect");
    expect(bars).toHaveLength(2);
    expect(Number(bars[0].getAttribute("height"))).toBeGreaterThan(
      Number(bars[1].getAttribute("height")),
    );
    for (const bar of bars) {
      expect(Number(bar.getAttribute("x"))).toBeGreaterThanOrEqual(0);
      expect(
        Number(bar.getAttribute("x")) + Number(bar.getAttribute("width")),
      ).toBeLessThanOrEqual(640);
    }
    expect(
      container.querySelector('path[stroke-dasharray="3 3"]'),
    ).not.toBeNull();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /18 commits across 3 days/,
    );
  });
  it("announces the selected day through keyboard navigation, including zero-count days", () => {
    render(<ActivityChart series={series} />);
    const chart = screen.getByRole("group");
    fireEvent.focus(chart);
    expect(screen.getByRole("status")).toHaveTextContent("Oct 3: 6 commits");
    fireEvent.keyDown(chart, { key: "Home" });
    expect(screen.getByRole("status")).toHaveTextContent("Oct 1: 0 commits");
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(screen.getByRole("status")).toHaveTextContent("Oct 2: 12 commits");
    fireEvent.keyDown(chart, { key: "End" });
    expect(screen.getByRole("status")).toHaveTextContent("Oct 3: 6 commits");
  });
});
