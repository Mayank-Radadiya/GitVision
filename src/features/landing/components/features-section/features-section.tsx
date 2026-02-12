"use client";

import { useRef, memo } from "react";
import { useInView } from "framer-motion";
import { FeaturesHeader } from "./features-header";
import { FeaturesGrid } from "./features-grid";

function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" ref={ref} className="py-28 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-grid-small-black/[0.15] dark:bg-grid-small-white/[0.03]" />
      <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

      {/* Ambient orbs */}
      <div className="absolute -left-1/4 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute -right-1/4 bottom-1/3 h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[100px]" />

      <div className="container relative px-4 mx-auto">
        <FeaturesHeader isInView={isInView} />
        <FeaturesGrid isInView={isInView} />
      </div>
    </section>
  );
}

export default memo(FeaturesSection);
