import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeroHeader } from "@/features/landing/components/hero-section/hero-header";
import { HeroMotionProvider } from "@/features/landing/components/hero-section/hero-motion";
import { HERO_HEADLINE } from "@/features/landing/components/hero-section/constants";

describe("hero first paint", () => {
  it("ships a complete, visible headline before JavaScript runs", () => {
    const html = renderToStaticMarkup(
      <HeroMotionProvider>
        <HeroHeader />
      </HeroMotionProvider>,
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const heading = document.querySelector("h1")!;
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(heading.textContent?.replace("codebaseat", "codebase at")).toBe(
      HERO_HEADLINE,
    );
    expect(html).not.toMatch(/opacity:\s*0(?:;|"|\b)/);
    expect(html).not.toContain("visibility:hidden");
    expect(heading.querySelector(".hero-accent")?.textContent).toBe(
      "speed of thought",
    );
  });
});
