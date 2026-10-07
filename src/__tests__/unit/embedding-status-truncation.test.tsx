import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IndexingStatusBadge } from "@/src/features/projects/components/project-view/indexing-status-badge";

// A capped run writes real counters, so the badge reads numbers. The old
// version regex-scraped "Indexed N of M files" out of `embeddingError`; the
// prose is still stored (the failed-state copy needs it) but nothing parses it
// here any more.
describe("IndexingStatusBadge", () => {
  it("renders the pipeline's own counts for a partial index", () => {
    render(
      <IndexingStatusBadge
        embeddingStatus="partial"
        totalFiles={1200}
        indexedFileCount={500}
        totalFileCount={1200}
      />,
    );

    expect(
      screen.getByText("Partial index — indexed 500 of 1200 files"),
    ).toBeInTheDocument();
  });

  it("prefers the run denominator over the GitHub-reported file count", () => {
    render(
      <IndexingStatusBadge
        embeddingStatus="partial"
        totalFiles={3000}
        indexedFileCount={500}
        totalFileCount={1200}
      />,
    );

    expect(
      screen.getByText("Partial index — indexed 500 of 1200 files"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Partial index — indexed 500 of 3000 files"),
    ).not.toBeInTheDocument();
  });

  it("falls back to the GitHub-reported count when the run wrote none", () => {
    render(
      <IndexingStatusBadge
        embeddingStatus="partial"
        totalFiles={1200}
        indexedFileCount={null}
        totalFileCount={null}
      />,
    );

    expect(
      screen.getByText("Partial index — indexed 0 of 1200 files"),
    ).toBeInTheDocument();
  });

  it("falls back to a count-free message when no denominator is known", () => {
    render(
      <IndexingStatusBadge
        embeddingStatus="partial"
        totalFiles={null}
        indexedFileCount={null}
        totalFileCount={0}
      />,
    );

    expect(
      screen.getByText("Partial index — some files not indexed"),
    ).toBeInTheDocument();
  });

  it.each([
    ["completed", "AI ready"],
    ["pending", "Queued for indexing"],
    ["processing", "Indexing"],
    ["failed", "Indexing failed"],
    [null, "Index status unavailable"],
  ])("accurately describes status %s", (status, label) => {
    render(
      <IndexingStatusBadge
        embeddingStatus={status}
        totalFiles={1200}
        indexedFileCount={500}
        totalFileCount={1200}
      />,
    );

    expect(screen.getByText(label!)).toBeInTheDocument();
  });
});
