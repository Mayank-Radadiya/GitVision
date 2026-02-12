import { memo } from "react";
import { SparklesCore } from "@/shared/components/animation/sparkles";

const MemoizedSparklesCore = memo(SparklesCore);

export function HeroBackground() {
  return (
    <>
      {/* Grid layers */}
      <div className="absolute inset-0 bg-grid-small-black/[0.15] dark:bg-grid-small-white/[0.05]" />
      <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
      <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

      {/* Sparkles */}
      <div className="absolute inset-0 h-full w-full">
        <MemoizedSparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.4}
          maxSize={1.6}
          particleDensity={120}
          className="h-full w-full"
          particleColor="#7928CA"
        />
      </div>
    </>
  );
}
