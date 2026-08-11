"use client";

import { useRef, memo } from "react";
import { useInView } from "framer-motion";
import { FeaturesHeader } from "./features-header";
import { FeaturesGrid } from "./features-grid";

function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" ref={ref} className="relative overflow-hidden py-28">
      {/* Background */}
      <div className="bg-grid-small-black/15 dark:bg-grid-small-white/3 absolute inset-0" />
      <div className="bg-background absolute inset-0 mask-[radial-gradient(ellipse_at_center,transparent_20%,black)]" />

      {/* Ambient orbs */}
      <div className="bg-primary/5 absolute top-1/3 -left-1/4 h-125 w-125 rounded-full blur-[120px]" />
      <div className="absolute -right-1/4 bottom-1/3 h-100 w-100 rounded-full bg-purple-500/5 blur-[100px]" />

      <div className="relative container mx-auto px-4">
        <FeaturesHeader isInView={isInView} />
        <FeaturesGrid isInView={isInView} />
      </div>
    </section>
  );
}

export default memo(FeaturesSection);
