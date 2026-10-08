import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroReveal } from "./hero-motion";

export function HeroBadge() {
  return (
    <HeroReveal order={0} className="mb-7 flex justify-center sm:mb-8">
      <Link
        href="#features"
        className="hero-control border-border bg-card inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-2 text-[10px] leading-5 sm:gap-3 sm:px-4 sm:text-xs"
      >
        <span>
          <span className="hero-accent font-semibold">GitVision 2.0:</span>{" "}
          <span className="text-muted-foreground">
            Instant RAG Codebase Vector Search
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="hero-accent size-3.5 shrink-0"
        />
      </Link>
    </HeroReveal>
  );
}
