import { describe, expect, it } from "vitest";
import {
  clampProgress,
  formatViewerStrip,
  statusDetailFor,
} from "@/src/features/projects/components/project-view/code-viewer/file-stats";

const summary = {
  stored: 1201,
  indexed: 1043,
  skipped: 158,
  notIndexed: 0,
  chunks: 5123,
  tokens: 38123456,
  lines: 412908,
  bytes: 19327349,
};

describe("formatViewerStrip", () => {
  it("keeps the stored caption raw for the ingestion E2E matcher", () => {
    const strip = formatViewerStrip(summary, {
      status: "completed",
      repoFileCount: 1201,
      estimatedTokens: 38123456,
    });

    expect(strip.storedCaption).toBe("1201 files");
    expect(strip.secondaryCaption).toBeUndefined();
  });

  it("adds an honest stored-files caption only when GitHub reported more", () => {
    const strip = formatViewerStrip(summary, {
      status: "partial",
      repoFileCount: 1800,
      estimatedTokens: 38123456,
    });

    expect(strip.secondaryCaption).toBe("1,201 of 1,800 stored");
    expect(strip.statusDetail).toContain("Capped index");
  });

  it("renders an em dash when the token footprint is unknown", () => {
    const strip = formatViewerStrip(summary, {
      status: "processing",
      repoFileCount: null,
      estimatedTokens: null,
    });

    expect(strip.tokensCaption).toBe("—");
    expect(statusDetailFor("processing")).toContain("running");
  });

  it("clamps run progress into a displayable range", () => {
    expect(clampProgress(-3)).toBe(0);
    expect(clampProgress(142)).toBe(100);
    expect(clampProgress(Number.NaN)).toBeNull();
  });
});
