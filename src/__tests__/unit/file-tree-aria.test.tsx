import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FileTree from "@/src/features/projects/components/project-view/code-viewer/file-tree";
import type { TreeNode } from "@/src/features/projects/components/project-view/code-viewer/utils";

const file = (path: string, name: string): TreeNode => ({
  name,
  path,
  type: "file",
  children: [],
  language: "typescript",
});

/**
 * `src` auto-expands because it is a top-level directory, so the rendered order
 * is: src, src/index.ts, src/lib, README.md.
 */
const tree: TreeNode[] = [
  {
    name: "src",
    path: "src",
    type: "directory",
    children: [
      file("src/index.ts", "index.ts"),
      {
        name: "lib",
        path: "src/lib",
        type: "directory",
        children: [
          file("src/lib/a.ts", "a.ts"),
          file("src/lib/b.ts", "b.ts"),
        ],
      },
    ],
  },
  { ...file("README.md", "README.md"), language: "markdown" },
];

function renderTree(selectedPath: string | null = null) {
  const onSelect = vi.fn();
  const utils = render(
    <FileTree tree={tree} selectedPath={selectedPath} onSelect={onSelect} />,
  );
  return { onSelect, ...utils };
}

function rows() {
  return screen.getAllByRole("treeitem") as HTMLElement[];
}

function row(path: string) {
  return rows().find((candidate) => candidate.dataset.path === path) as HTMLElement;
}

function tabbable() {
  return rows().filter((row) => row.tabIndex === 0);
}

describe("FileTree", () => {
  it("exposes itself as a tree", () => {
    renderTree();
    expect(screen.getByRole("tree")).toBeInTheDocument();
  });

  it("marks directories as expanded or collapsed and leaves files alone", () => {
    renderTree();

    expect(row("src").getAttribute("aria-expanded")).toBe("true");
    expect(row("src/lib").getAttribute("aria-expanded")).toBe("false");
    expect(row("src/index.ts").getAttribute("aria-expanded")).toBeNull();

    fireEvent.click(row("src/lib").querySelector("button") as HTMLButtonElement);

    expect(row("src/lib").getAttribute("aria-expanded")).toBe("true");
  });

  it("marks the selected file", () => {
    renderTree("src/index.ts");

    expect(row("src/index.ts").getAttribute("aria-selected")).toBe("true");
    expect(row("README.md").getAttribute("aria-selected")).toBe("false");
  });

  it("keeps exactly one row in the tab order", () => {
    renderTree();

    const stop = tabbable();
    expect(stop).toHaveLength(1);
    expect(stop[0]).toBe(row("src"));
  });

  it("moves the tab stop with the arrow keys", () => {
    renderTree();
    const first = row("src");
    first.focus();

    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(row("src/index.ts"));
    expect(tabbable()).toEqual([row("src/index.ts")]);

    fireEvent.keyDown(row("src/index.ts"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(row("src"));
    expect(tabbable()).toEqual([row("src")]);
  });

  it("jumps to the last row with End and back with Home", () => {
    renderTree();
    const first = row("src");
    first.focus();

    fireEvent.keyDown(first, { key: "End" });
    expect(document.activeElement).toBe(row("README.md"));

    fireEvent.keyDown(row("README.md"), { key: "Home" });
    expect(document.activeElement).toBe(row("src"));
  });

  it("expands and collapses a directory with the right and left arrows", () => {
    renderTree();
    const lib = row("src/lib");
    lib.focus();

    fireEvent.keyDown(lib, { key: "ArrowRight" });
    expect(row("src/lib").getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(row("src/lib"));

    fireEvent.keyDown(row("src/lib"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(row("src/lib/a.ts"));

    fireEvent.keyDown(row("src/lib/a.ts"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(row("src/lib"));

    fireEvent.keyDown(row("src/lib"), { key: "ArrowLeft" });
    expect(row("src/lib").getAttribute("aria-expanded")).toBe("false");
  });

  it("moves to the parent directory with the left arrow on a file", () => {
    renderTree();
    row("src/index.ts").focus();

    fireEvent.keyDown(row("src/index.ts"), { key: "ArrowLeft" });

    expect(document.activeElement).toBe(row("src"));
  });

  it("activates a row with Enter and Space", () => {
    const { onSelect } = renderTree();
    row("src/index.ts").focus();

    fireEvent.keyDown(row("src/index.ts"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("src/index.ts");

    row("src/lib").focus();
    fireEvent.keyDown(row("src/lib"), { key: " " });
    expect(row("src/lib").getAttribute("aria-expanded")).toBe("true");
  });

  it("moves the tab stop when a row is clicked", () => {
    const { onSelect } = renderTree();

    fireEvent.click(
      row("README.md").querySelector("button") as HTMLButtonElement,
    );

    expect(onSelect).toHaveBeenCalledWith("README.md");
    expect(tabbable()).toEqual([row("README.md")]);
  });

  it("keeps a tab stop when the row holding it is collapsed away", () => {
    renderTree();
    const first = row("src");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(tabbable()).toEqual([row("src/index.ts")]);

    fireEvent.click(row("src").querySelector("button") as HTMLButtonElement);

    expect(rows()).toHaveLength(2);
    expect(tabbable()).toEqual([row("src")]);
  });
});
