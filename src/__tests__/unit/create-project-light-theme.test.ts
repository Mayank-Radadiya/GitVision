/**
 * The create-project page was dark-locked, so switching the app to light mode
 * rendered a white sidebar next to a black page.
 *
 * Three separate things held it there, and all three had to go:
 *
 *  1. `.gv-page` set `color-scheme: dark` unconditionally and painted
 *     `--ink-950` as its background.
 *  2. The `gv-*` palette is an alias layer over `--ink-*` / `--text-*`, and
 *     those primitives had exactly one set of values in `:root`.
 *  3. Several controls reached for `border-white/…` directly, which is
 *     invisible on a white surface.
 *
 * The fix was a token-scope override mirroring `.project-workspace`: light
 * values on `.gv-page`, the dark values re-pinned on `.dark .gv-page`. Because
 * `gv-*` are aliases, re-pointing the primitives re-points all ten at once, so
 * the components needed no class changes beyond the raw-white borders.
 *
 * This pins the three invariants so none of them quietly returns.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const globals = readFileSync(join(ROOT, "app/globals.css"), "utf8");
const COMPONENT_DIR = join(
  ROOT,
  "src/features/projects/components/create-project",
);

function readComponentTree(): Array<{ path: string; source: string }> {
  const out: Array<{ path: string; source: string }> = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        out.push({
          path: full.slice(ROOT.length + 1),
          source: readFileSync(full, "utf8"),
        });
      }
    }
  };

  walk(COMPONENT_DIR);
  return out;
}

const components = readComponentTree();

/** Extracts one CSS rule body by selector, e.g. `gvPage(".dark .gv-page")`. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = globals.match(new RegExp(`(^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`rule not found: ${selector}`);
  return match[2];
}

/** Every `--token` the create-project tree resolves at runtime. */
function declaredTokens(selector: string): Set<string> {
  return new Set(
    [...ruleBody(selector).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
  );
}

describe("create-project light theme", () => {
  it("reads at least one component, so the scans below are not vacuous", () => {
    expect(components.length).toBeGreaterThan(5);
  });

  it("paints the page surface per theme instead of forcing dark", () => {
    const light = ruleBody(".gv-page");

    expect(light).toMatch(/color-scheme:\s*light/);
    expect(light).not.toMatch(/color-scheme:\s*dark/);
    expect(globals).toMatch(/\.dark \.gv-page\s*\{[^}]*color-scheme:\s*dark/);
  });

  it("re-points the aliased primitives on both themes", () => {
    // Every one of these is what a `gv-*` alias resolves to. If a theme block
    // omits one, that token silently falls through to `:root` and the other
    // theme leaks its palette into this page.
    const primitives = [
      "--ink-950",
      "--ink-900",
      "--ink-800",
      "--text-100",
      "--text-500",
      "--gv-hairline",
      "--gv-amber",
    ];

    for (const selector of [".gv-page", ".dark .gv-page"]) {
      const declared = declaredTokens(selector);
      for (const primitive of primitives) {
        expect(declared, `${primitive} missing from ${selector}`).toContain(
          primitive,
        );
      }
    }
  });

  it("defines the derived surface tokens it consumes on both themes", () => {
    // `.gv-card` and the input inset read these through `var()`; a missing
    // definition is an invalid declaration, not a fallback.
    for (const selector of [".gv-page", ".dark .gv-page"]) {
      const declared = declaredTokens(selector);
      for (const token of [
        "--gv-card-top",
        "--gv-card-inset",
        "--gv-card-glow",
        "--gv-amber-fg",
      ]) {
        expect(declared, `${token} missing from ${selector}`).toContain(token);
      }
    }

    // And they are registered as Tailwind colors, or `text-gv-amber-fg`
    // compiles to nothing.
    expect(globals).toContain("--color-gv-amber-fg: var(--gv-amber-fg);");
  });

  it("keeps the amber button label legible in light mode", () => {
    // `--gv-void` flips to near-white under `.gv-page`, so a label coloured
    // with it would be white text on an amber fill. The button label needs the
    // dedicated token instead.
    expect(
      components.find((c) => c.path.endsWith("SubmitButton.tsx"))?.source,
    ).not.toMatch(/text-gv-void/);
  });

  it("hardcodes no raw-white or raw-black surface in the component tree", () => {
    // A surface or text colour pinned to white or black is invisible on the
    // theme it was not authored for.
    const offenders: string[] = [];

    for (const { path, source } of components) {
      // The ⌘↵ hint is black-on-amber in both themes by design, so it is
      // excluded here and asserted on its own below.
      const scannable = source.replace(
        /<kbd\b[^>]*>[\s\S]*?<\/kbd>/g,
        "",
      );
      const surface =
        /\b(?:bg|border|text|ring|fill|shadow)-(?:white|black)(?:\/|\s|"|')/g;
      const found = scannable.match(surface) ?? [];
      if (found.length > 0) offenders.push(`${path}: ${found.join(", ")}`);
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the loading sweep and the kbd hint readable on the amber fill", () => {
    // These two sit on the submit button's amber gradient, which is the same
    // colour in both themes, so a fixed overlay is correct here rather than a
    // token reference. They are exempt from the scan above because that one
    // covers `bg-*`/`text-*`/`border-*`, and this asserts the intent directly.
    const button =
      components.find((c) => c.path.endsWith("SubmitButton.tsx"))?.source ??
      "";

    expect(button).toMatch(/from-transparent via-white\/20 to-transparent/);
    expect(button).toMatch(/border-black\/20 bg-black\/15[^"]*text-black\/80/);
  });

  it("picks a grid backdrop that is visible on the page it sits on", () => {
    // `bg-grid-small-white` is a 4% white hairline — invisible on white. Both
    // grid users on this page have to take the dark grid in light mode.
    for (const relative of [
      "app/(main)/create-project/loading.tsx",
      "src/features/projects/components/create-project/add-repo.tsx",
    ]) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      expect(source, relative).toContain(
        "bg-grid-small-black dark:bg-grid-small-white",
      );
    }

    // And the light-side grid actually exists.
    expect(globals).toMatch(/@utility bg-grid-small-black\s*\{/);
  });
});
