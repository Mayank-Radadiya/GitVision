import { describe, expect, it } from "vitest";
import {
  readWorkspaceLocation,
  workspaceUrl,
} from "@/features/projects/components/project-view/workspace-navigation";

describe("project URL navigation", () => {
  it("defaults safely on missing or invalid values", () => {
    expect(readWorkspaceLocation(new URLSearchParams())).toEqual({
      section: "overview",
      days: 30,
    });
    expect(
      readWorkspaceLocation(new URLSearchParams("section=missing&days=365")),
    ).toEqual({ section: "overview", days: 30 });
  });
  it.each([7, 30, 90])("reads a direct Files link over %i days", (days) => {
    expect(
      readWorkspaceLocation(new URLSearchParams(`section=files&days=${days}`)),
    ).toEqual({ section: "files", days });
  });
  it("preserves file, line, and unrelated query parameters", () => {
    const params = new URLSearchParams(
      "file=src%2Fapp.tsx&line=24&days=7&source=chat",
    );
    const url = workspaceUrl("/dashboard/user-project/p1", params, {
      section: "files",
    });
    const result = new URL(url, "http://localhost");
    expect(result.searchParams.get("file")).toBe("src/app.tsx");
    expect(result.searchParams.get("line")).toBe("24");
    expect(result.searchParams.get("source")).toBe("chat");
    expect(readWorkspaceLocation(result.searchParams)).toEqual({
      section: "files",
      days: 7,
    });
    expect(params.has("section")).toBe(false);
  });
  it("returns to canonical defaults without dropping unrelated parameters", () => {
    expect(
      workspaceUrl(
        "/project",
        new URLSearchParams("section=issues&days=7&file=a.ts"),
        { section: "overview", days: 30 },
      ),
    ).toBe("/project?file=a.ts");
  });
});
