"use client";

import { useRef, memo } from "react";
import { useInView } from "framer-motion";
import { PricingHeader } from "./pricing-header";
import { PricingGrid } from "./pricing-grid";

function PricingSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="pricing" ref={ref} className="relative overflow-hidden py-28">
      {/* Background */}
      <div className="bg-grid-small-black/15 dark:bg-grid-small-white/3 absolute inset-0" />
      <div className="bg-background absolute inset-0 mask-[radial-gradient(ellipse_at_center,transparent_20%,black)]" />

      {/* Ambient orbs */}
      <div className="bg-primary/5 absolute top-1/4 -left-1/4 h-100 w-100 rounded-full blur-[120px]" />
      <div className="absolute -right-1/4 bottom-1/4 h-100 w-100 rounded-full bg-blue-500/5 blur-[100px]" />

      <div className="relative container mx-auto max-w-7xl px-4">
        <PricingHeader isInView={isInView} />
        <PricingGrid isInView={isInView} />
      </div>
    </section>
  );
}

export default memo(PricingSection);
