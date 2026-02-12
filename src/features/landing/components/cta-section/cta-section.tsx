"use client";

import { useRef, memo } from "react";
import { useInView } from "framer-motion";
import { SparklesCore } from "@/shared/components/animation/sparkles";
import { CtaContent } from "./cta-content";
import { CtaTrustRow } from "./cta-trust-row";

function CtaSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative overflow-hidden py-28">
      {/* Background */}
      <div className="absolute inset-0 bg-grid-small-black/[0.15] dark:bg-grid-small-white/[0.03]" />
      <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

      {/* Ambient orbs */}
      <div className="absolute left-1/4 top-0 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute right-1/4 bottom-0 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[100px]" />

      {/* Sparkles */}
      <div className="absolute inset-0 h-full w-full">
        <SparklesCore
          id="tsparticlesfullpage2"
          background="transparent"
          minSize={0.4}
          maxSize={1.4}
          particleDensity={60}
          className="h-full w-full"
          particleColor="#7928CA"
        />
      </div>

      <div className="container relative z-10 px-4 mx-auto">
        <div className="mx-auto max-w-3xl text-center">
          <CtaContent isInView={isInView} />
          <CtaTrustRow isInView={isInView} />
        </div>
      </div>
    </section>
  );
}

export default memo(CtaSection);
