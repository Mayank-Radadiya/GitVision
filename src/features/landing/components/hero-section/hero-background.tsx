import { memo } from "react";
import { SparklesCore } from "@/shared/components/animation/sparkles";

const MemoizedSparklesCore = memo(SparklesCore);

export function HeroBackground() {
  return (
    <>
      {/* Grid layers */}
      <div className="bg-grid-small-black/15 dark:bg-grid-small-white/5 absolute inset-0" />
      <div className="bg-background absolute inset-0 mask-[radial-gradient(ellipse_at_center,transparent_20%,black)]" />
      <div className="bg-background absolute inset-0 mask-[radial-gradient(ellipse_at_center,transparent_20%,black)]" />

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
