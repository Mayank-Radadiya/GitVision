import type { MotionValue } from "framer-motion";
import { motion } from "framer-motion";
import Image from "next/image";
import { FloatingBadge } from "./floating-badge";
import { FLOATING_BADGES } from "./constants";

interface HeroPreviewProps {
  y: MotionValue<number>;
  showExtras: boolean;
}

export function HeroPreview({ y, showExtras }: HeroPreviewProps) {
  return (
    <motion.div
      style={{ y }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.4 }}
      className="relative hidden lg:block items-center justify-center mt-16"
    >
      {/* Floating badges */}
      {showExtras &&
        FLOATING_BADGES.map((badge) => (
          <FloatingBadge
            key={badge.text}
            icon={badge.icon}
            text={badge.text}
            className={badge.className}
            delay={badge.delay}
          />
        ))}

      {/* Outer gradient glow */}
      <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/30 via-purple-500/20 to-primary/30 blur-2xl opacity-70 animate-pulse" />

      {/* Main container */}
      <div className="relative overflow-hidden rounded-xl border border-border/60 shadow-2xl bg-background/5 backdrop-blur-sm mt-8">
        {/* Mac chrome */}
        <div className="h-8 w-full bg-muted/80 flex items-center px-4 gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <div className="ml-2 h-5 w-48 rounded-full bg-background/60" />
        </div>

        {/* Image */}
        <div className="relative p-1 object-cover overflow-hidden group">
          <Image
            src="/hero2.jpg"
            width={1250}
            height={650}
            alt="GitVision Dashboard — AI-powered repository analysis"
            className="rounded-lg shadow-sm transition-all duration-700 group-hover:scale-[1.02] group-hover:brightness-105"
            sizes="(max-width: 1023px) 100vw, 1250px"
            priority
          />
          {/* Shine on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-[1500ms] ease-in-out pointer-events-none" />
        </div>
      </div>

      {/* Ambient glow */}
      <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-primary/20 blur-2xl animate-pulse" />
      <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-purple-500/20 blur-3xl animate-pulse" />
    </motion.div>
  );
}
