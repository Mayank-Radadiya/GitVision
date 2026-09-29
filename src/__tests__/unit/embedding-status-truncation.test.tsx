import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  IndexingStatusBadge,
  parseIndexedCounts,
} from "@/src/features/projects/components/project-view/indexing-status-badge";

const partialError = (indexed: number, total: number) =>
  `Indexed ${indexed} of ${total} files — the repository exceeds the 500-file embedding cap, so the remaining ${total - indexed} files are not searchable.`;

describe("parseIndexedCounts", () => {
  it("reads the indexed and total counts out of the truncation message", () => {
    expect(parseIndexedCounts(partialError(500, 1200))).toEqual({ indexed: 500, total: 1200 });
  });

  it("returns null for any other message", () => {
    expect(parseIndexedCounts("Embedding job failed after all retries: boom")).toBeNull();
    expect(parseIndexedCounts(null)).toBeNull();
    expect(parseIndexedCounts(undefined)).toBeNull();
  });
});

describe("IndexingStatusBadge", () => {
  it("shows how much of the project is searchable when the index is partial", () => {
    render(
      <IndexingStatusBadge
        embeddingStatus="partial"
        totalFiles={1200}
        embeddingError={partialError(500, 1200)}
      />,
    );

    expect(screen.getByText("Partial index — indexed 500 of 1200 files")).toBeDefined();
    expect(screen.queryByText("AI Synced")).toBeNull();
  });

  it("falls back to the stored file count when the truncation message is missing", () => {
    render(<IndexingStatusBadge embeddingStatus="partial" totalFiles={1200} embeddingError={null} />);

    expect(screen.getByText("Partial index — 1200 files not indexed")).toBeDefined();
  });

  it("still says AI Synced for a fully indexed project", () => {
    render(
      <IndexingStatusBadge
        embeddingStatus="completed"
        totalFiles={42}
        embeddingError={null}
      />,
    );

    expect(screen.getByText("AI Synced")).toBeDefined();
    expect(screen.queryByText(/Partial index/)).toBeNull();
  });
});
