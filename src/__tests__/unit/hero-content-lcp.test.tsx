import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroContent } from "@/src/features/landing/components/hero-section/hero-content";

/**
 * The <h1> is the LCP element on `/`. The server ships the framer-motion
 * `initial="hidden"` state as inline CSS, so anything that hides the
 * headline before JS runs delays LCP by the whole hydration round-trip.
 */
describe("HeroContent", () => {
  it("does not render the headline at opacity 0 before hydration", () => {
    render(<HeroContent />);

    const headline = screen.getByRole("heading", { level: 1 });

    expect(headline.style.opacity).not.toBe("0");
  });
});
