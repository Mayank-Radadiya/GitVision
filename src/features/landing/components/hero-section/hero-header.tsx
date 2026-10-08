import { HeroReveal } from "./hero-motion";

export function HeroHeader() {
  return (
    <header>
      <HeroReveal order={1} headline>
        <h1
          id="hero-heading"
          className="font-gv-display mx-auto max-w-5xl text-[clamp(2.5rem,5.5vw,5rem)] leading-[1.04] font-semibold tracking-[-0.055em] text-balance"
        >
          <span className="block">Understand any codebase</span>{" "}
          <span className="block">
            at the <span className="hero-accent">speed of thought</span>
          </span>
        </h1>
      </HeroReveal>
      <HeroReveal order={2}>
        <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-[15px] leading-7 text-pretty sm:text-base">
          GitVision deeply indexes your repository so you can ask questions and
          get AI answers that cite the source code.
        </p>
      </HeroReveal>
    </header>
  );
}
