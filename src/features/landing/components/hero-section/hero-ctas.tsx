"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { HeroMagnetic, HeroReveal } from "./hero-motion";

export function HeroCtas() {
  return (
    <HeroReveal
      order={4}
      className="mx-auto mt-5 flex max-w-xl flex-col justify-center gap-3 sm:flex-row"
    >
      <HeroMagnetic>
        <Link
          href="/sign-up"
          className="hero-control hero-primary inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-transparent px-6 text-sm font-semibold"
        >
          Get started for free{" "}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </HeroMagnetic>
      <HeroMagnetic>
        <Link
          href="#features"
          className="hero-control border-border bg-card text-foreground inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border px-6 text-sm font-medium"
        >
          <Play aria-hidden="true" className="size-3.5" /> See how it works
        </Link>
      </HeroMagnetic>
    </HeroReveal>
  );
}
