import { describe, expect, it } from "vitest";
import {
  VIEWER_KEY_BINDINGS,
  isTypingTarget,
  resolveViewerCommand,
} from "@/features/projects/components/project-view/code-viewer/viewer-keys";

describe("resolveViewerCommand", () => {
  it("binds ⌘K and Ctrl+K to the palette, in either case", () => {
    expect(resolveViewerCommand({ key: "k", metaKey: true, typing: false })).toBe(
      "open-palette",
    );
    expect(resolveViewerCommand({ key: "K", ctrlKey: true, typing: false })).toBe(
      "open-palette",
    );
    expect(resolveViewerCommand({ key: "k", ctrlKey: true, typing: false })).toBe(
      "open-palette",
    );
  });

  it("binds ⌘B and Ctrl+B to the rail", () => {
    expect(resolveViewerCommand({ key: "b", metaKey: true, typing: false })).toBe(
      "toggle-rail",
    );
    expect(resolveViewerCommand({ key: "B", ctrlKey: true, typing: false })).toBe(
      "toggle-rail",
    );
  });

  /**
   * This is the case that matters most in practice: the explorer's search box
   * is an input, and a reader who has just typed there presses ⌘K expecting
   * the palette, not a literal "k" in the box.
   */
  it("honours chords while typing", () => {
    expect(resolveViewerCommand({ key: "k", metaKey: true, typing: true })).toBe(
      "open-palette",
    );
    expect(resolveViewerCommand({ key: "b", ctrlKey: true, typing: true })).toBe(
      "toggle-rail",
    );
  });

  it("never binds a bare key while typing", () => {
    // "/" and "t" are ordinary characters in a search query.
    expect(
      resolveViewerCommand({ key: "/", typing: true }),
    ).toBeNull();
    expect(
      resolveViewerCommand({ key: "t", typing: true }),
    ).toBeNull();
    expect(
      resolveViewerCommand({ key: "?", typing: true }),
    ).toBeNull();
  });

  it("binds /, t/T and ? when not typing", () => {
    expect(resolveViewerCommand({ key: "/", typing: false })).toBe("focus-search");
    expect(resolveViewerCommand({ key: "t", typing: false })).toBe("toggle-insights");
    expect(resolveViewerCommand({ key: "T", typing: false })).toBe("toggle-insights");
    expect(resolveViewerCommand({ key: "?", typing: false })).toBe("show-shortcuts");
  });

  it("leaves everything else — especially the tree's keys — alone", () => {
    for (const key of [
      "ArrowDown",
      "ArrowUp",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "Enter",
      " ",
      "j",
      "k",
      "g",
      "G",
      "Escape",
    ]) {
      expect(resolveViewerCommand({ key, typing: false })).toBeNull();
    }
  });

  it("ignores chords it does not bind", () => {
    expect(resolveViewerCommand({ key: "p", metaKey: true, typing: false })).toBeNull();
    expect(resolveViewerCommand({ key: "a", altKey: true, typing: false })).toBeNull();
    expect(resolveViewerCommand({ key: "t", ctrlKey: true, typing: false })).toBeNull();
  });

  it("treats any modifier plus K/B as the binding, so AltGr still reaches it", () => {
    // Alt+K is a common alternative chord, and on Windows AltGr reports
    // Ctrl+Alt — resolving the letter rather than the modifier keeps both.
    expect(resolveViewerCommand({ key: "k", altKey: true, typing: false })).toBe(
      "open-palette",
    );
  });
});

describe("VIEWER_KEY_BINDINGS", () => {
  it("documents every command the resolver can return", () => {
    const commands = new Set(VIEWER_KEY_BINDINGS.map((binding) => binding.id));
    for (const command of [
      "open-palette",
      "focus-search",
      "toggle-insights",
      "toggle-rail",
      "show-shortcuts",
    ]) {
      expect(commands).toContain(command);
    }
  });

  it("keeps the sheet's caps non-empty so no key renders as a blank", () => {
    for (const binding of VIEWER_KEY_BINDINGS) {
      expect(binding.caps.length).toBeGreaterThan(0);
      for (const cap of binding.caps) {
        expect(cap.trim()).not.toBe("");
      }
    }
  });
});

describe("isTypingTarget", () => {
  function target(tag: string, extra: Partial<HTMLElement> = {}): HTMLElement {
    const el = document.createElement(tag);
    Object.assign(el, extra);
    return el;
  }

  it("recognises text fields and contenteditable subtrees", () => {
    expect(isTypingTarget(target("input"))).toBe(true);
    expect(isTypingTarget(target("textarea"))).toBe(true);
    expect(isTypingTarget(target("select"))).toBe(true);
    expect(isTypingTarget(target("div", { isContentEditable: true }))).toBe(true);
  });

  it("does not treat a plain click target as typing", () => {
    expect(isTypingTarget(target("div"))).toBe(false);
    expect(isTypingTarget(target("button"))).toBe(false);
    expect(isTypingTarget(target("td"))).toBe(false);
  });

  it("handles a missing or non-element target", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({ notAnEventTarget: true } as unknown as EventTarget)).toBe(
      false,
    );
  });
});
