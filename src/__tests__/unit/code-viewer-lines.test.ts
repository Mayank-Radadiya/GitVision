import { describe, expect, it } from "vitest";
import { splitHighlightedLines } from "@/src/features/projects/components/project-view/code-viewer/utils";

/**
 * Shiki emits `<pre style="..."><code><span class="line">…</span>\n<span
 * class="line">…</span></code></pre>`. The virtualizer needs those lines as
 * separate strings, so these tests pin the split and the raw-text fallback.
 */

const TWO_LINES = [
  '<pre class="shiki github-dark" style="background-color:#24292e;color:#e1e4e8" tabindex="0"><code>',
  '<span class="line">const a = 1;</span>\n',
  '<span class="line"><span style="color:#F97583">const</span> b = 2;</span>',
  "</code></pre>",
].join("");

const FALLBACK = '<pre class="shiki"><code>&lt;script&gt;x&lt;/script&gt;</code></pre>';

describe("splitHighlightedLines", () => {
  it("splits a shiki blob into one entry per line", () => {
    const { lines } = splitHighlightedLines(TWO_LINES, "const a = 1;\nconst b = 2;");
    expect(lines).toHaveLength(2);
  });

  it("keeps each line's inline token colors intact", () => {
    const { lines } = splitHighlightedLines(TWO_LINES, "const a = 1;\nconst b = 2;");
    expect(lines[0]).toContain("const a = 1;");
    expect(lines[1]).toContain('<span style="color:#F97583">const</span>');
  });

  it("gives each line exactly one line span — its own", () => {
    const { lines } = splitHighlightedLines(TWO_LINES, "const a = 1;\nconst b = 2;");
    for (const line of lines) {
      expect(line.match(/<span class="line">/g)).toHaveLength(1);
      // A row keeps its own wrapper (the tint + deep-link selectors key off
      // it) but must never carry a neighbour's markup.
      expect(line.match(/<\/span>\n/g)).toBeNull();
    }
  });

  it("lifts the pre background and color into preStyle", () => {
    const { preStyle } = splitHighlightedLines(TWO_LINES, "const a = 1;\nconst b = 2;");
    expect(preStyle.backgroundColor).toBe("#24292e");
    expect(preStyle.color).toBe("#e1e4e8");
  });

  it("falls back to escaped raw lines when there are no line spans", () => {
    const { lines } = splitHighlightedLines(FALLBACK, "<script>x</script>");
    expect(lines).toEqual(["&lt;script&gt;x&lt;/script&gt;"]);
  });

  it("keeps the raw-text fallback escaped", () => {
    const { lines } = splitHighlightedLines(FALLBACK, "<img src=x onerror=alert(1)>");
    expect(lines[0]).not.toContain("<img");
    expect(lines[0]).toContain("&lt;img");
  });

  it("yields a single empty line for empty content", () => {
    const { lines } = splitHighlightedLines("", "");
    expect(lines).toEqual([""]);
  });
});
