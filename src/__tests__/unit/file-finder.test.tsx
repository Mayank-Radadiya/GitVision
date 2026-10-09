import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FileFinder from "@/src/features/projects/components/project-view/code-viewer/file-finder";
import type { FileEntry } from "@/src/features/projects/components/project-view/code-viewer/utils";

const files: FileEntry[] = [
  { id: "1", path: "/src/components/button.tsx", language: "tsx" },
  { id: "2", path: "/src/lib/build-utils-ton.ts", language: "typescript" },
  { id: "3", path: "/README.md", language: "markdown" },
];

function renderFinder(query = "") {
  const onQuery = vi.fn();
  const onSelect = vi.fn();
  const utils = render(
    <FileFinder
      files={files}
      query={query}
      onQuery={onQuery}
      onSelect={onSelect}
    />,
  );
  return { onQuery, onSelect, ...utils };
}

describe("FileFinder", () => {
  it("ranks a basename boundary hit above a scattered coincidence", () => {
    renderFinder("button");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("button.tsx");
  });

  it("selects the top hit on Enter", () => {
    const { onSelect } = renderFinder("button");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("/src/components/button.tsx");
  });

  it("clears the query on Escape", () => {
    const { onQuery } = renderFinder("button");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(onQuery).toHaveBeenCalledWith("");
  });

  it("shows no dropdown when the query is empty", () => {
    renderFinder("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("announces an empty result with the query echoed", () => {
    renderFinder("zzz-no-match");
    expect(screen.getByRole("option")).toHaveTextContent("zzz-no-match");
  });
});
