/**
 * T54 — the landing page's asset and font weight.
 *
 * Four problems, all of them invisible in a code review and only obvious in a
 * profile:
 *
 * 1. Seven Google font families load, four of them preloaded. A preload says
 *    "fetch this before the browser decides", so four preloads fight each other
 *    and each one competes with the CSS and the hero image for the same
 *    connections. Two of the seven (`Fira_Code`, `Fira_Sans`) have no consumer
 *    at all — their CSS variables are never referenced outside `layout.tsx`.
 * 2. `og-image.png` is referenced by the OG and Twitter cards and does not
 *    exist, so every shared link renders without an image.
 * 3. The default avatar points at `via.placeholder.com`, a service that has
 *    been dead for years, and its host is not in `remotePatterns`, so next/image
 *    would refuse it anyway.
 * 4. `hero2.jpg` is 2.73 MB. It renders through `next/image`, so this is repo
 *    size and cold-build time rather than LCP — which is why it survived.
 *
 * This test pins all four so they cannot quietly come back.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf8");
const globals = readFileSync(join(ROOT, "app/globals.css"), "utf8");
const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");
const constants = readFileSync(join(ROOT, "src/lib/github/constants.ts"), "utf8");

describe("font loading", () => {
  it("loads at most three families", () => {
    // Count the `next/font/google` constructors, which is what actually
    // determines how many families the browser is asked to download.
    const families = [...layout.matchAll(/^const \w+ = (\w+)\(\{/gm)].map(
      (m) => m[1],
    );

    expect(families.length).toBeGreaterThan(0);
    expect(families.length).toBeLessThanOrEqual(3);
  });

  it("preloads at most one family", () => {
    // Every family has to say something. `next/font` preloads by default in a
    // production build, so "I did not write `preload: true`" does not mean "not
    // preloaded" — the build output confirmed all three were preloading until
    // the other two were given an explicit `preload: false`.
    const families = [
      ...layout.matchAll(
        /^const \w+ = \w+\(\{([^}]*)\}\)/gm,
      ),
    ].map((m) => m[1]);

    expect(families.length).toBeGreaterThan(0);
    for (const body of families) {
      expect(body).toMatch(/preload:\s*(true|false)/);
    }
    expect((layout.match(/preload: true/g) ?? []).length).toBe(1);
  });

  it("has no font family loaded without a consumer", () => {
    // A family whose CSS variable is only ever set in layout.tsx is nine
    // weight-faces of download for nothing.
    const variables = [...layout.matchAll(/variable: "(--font-[\w-]+)"/g)].map(
      (m) => m[1],
    );
    const orphans = variables.filter((variable) => {
      const consumers = readFileSync(join(ROOT, "app/globals.css"), "utf8");
      return !consumers.includes(`var(${variable})`);
    });

    expect(orphans).toEqual([]);
  });

  it("keeps every CSS variable the components reference", () => {
    // The create-project flow styles itself with `font-gv-display`, `font-gv-body`
    // and `font-gv-mono` in around fifty places. Cutting the families must
    // re-point these variables, not delete them.
    for (const token of [
      "--font-sans",
      "--font-mono",
      "--font-gv-display",
      "--font-gv-body",
      "--font-gv-mono",
    ]) {
      expect(globals).toContain(`${token}:`);
    }
  });
});

describe("open graph image", () => {
  it("exists at the path the metadata references", () => {
    const url = layout.match(/url: "https:\/\/[^"]*\/([^/"]+)"/)?.[1];

    expect(url).toBe("og-image.png");
    expect(existsSync(join(ROOT, "public", url as string))).toBe(true);
  });

  it("is a 1200x630 PNG, which is what the OG metadata claims", () => {
    const bytes = readFileSync(join(ROOT, "public/og-image.png"));

    // PNG magic number.
    expect(bytes.subarray(0, 8).toString("hex")).toBe(
      "89504e470d0a1a0a",
    );
    // IHDR width and height are big-endian uint32s at fixed offsets.
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  });

  it("is referenced by both the openGraph and twitter cards", () => {
    expect(layout).toContain("https://gitvision.vercel.app/og-image.png");
    expect((layout.match(/og-image\.png/g) ?? []).length).toBeGreaterThanOrEqual(
      2,
    );
  });
});

describe("default avatar host", () => {
  it("is a host next/image is configured to allow", () => {
    const host = new URL(
      /AVATAR: "([^"]+)"/.exec(constants)?.[1] ?? "",
    ).hostname;

    expect(host).not.toBe("");
    // A host that is not in remotePatterns makes next/image throw at render
    // time, which is how the placeholder survived as long as it did.
    expect(config).toContain(`hostname: "${host}"`);
  });

  it("does not use the retired placeholder service", () => {
    // Scoped to the value, not the file: the comment above `AVATAR` names the
    // service on purpose, so a file-wide match would flag the explanation of
    // why it was replaced.
    const value = /AVATAR: "([^"]+)"/.exec(constants)?.[1] ?? "";

    expect(value).not.toMatch(/via\.placeholder\.com/);
  });
});

describe("hero image weight", () => {
  it("is under 400 KB", () => {
    const bytes = statSync(join(ROOT, "public/hero2.jpg")).size;

    expect(bytes).toBeLessThan(400 * 1024);
  });

  it("is still a real JPEG, not a truncated file", () => {
    const bytes = readFileSync(join(ROOT, "public/hero2.jpg"));

    // JPEG files start FF D8 FF; a truncated download or a failed recompress
    // would leave the header intact and the body short, so also check the
    // end-of-image marker.
    expect(bytes.subarray(0, 3).toString("hex")).toBe("ffd8ff");
    expect(bytes.subarray(-2).toString("hex")).toBe("ffd9");
  });
});
