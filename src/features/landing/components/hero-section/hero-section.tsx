"use client";

import { useState, useEffect, memo } from "react";
import {
  LazyMotion,
  domAnimation,
  useScroll,
  useTransform,
} from "framer-motion";
import { HeroBackground } from "./hero-background";
import { HeroContent } from "./hero-content";
import { HeroSearchForm } from "./hero-search-form";
import { HeroCtas } from "./hero-ctas";
import { HeroStats } from "./hero-stats";
import { HeroPreview } from "./hero-preview";
import { SHOW_EXTRAS_DELAY } from "./constants";

function HeroSection() {
  const [showExtras, setShowExtras] = useState(false);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 50]);

  useEffect(() => {
    const timer = setTimeout(() => setShowExtras(true), SHOW_EXTRAS_DELAY);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <section className="bg-grid-small-black/20 dark:bg-grid-small-white/5 relative flex min-h-screen flex-col justify-center overflow-hidden pt-32 pb-24">
        <HeroBackground />

        <div className="relative z-10 container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <HeroContent />
            <HeroSearchForm />
            <HeroCtas />
            <HeroStats />
          </div>

          <HeroPreview y={y} showExtras={showExtras} />
        </div>
      </section>
    </LazyMotion>
  );
}

export default memo(HeroSection);
