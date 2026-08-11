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
      className="relative mt-16 hidden items-center justify-center lg:block"
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
      <div className="from-primary/30 to-primary/30 absolute -inset-0.5 animate-pulse rounded-xl bg-linear-to-r via-purple-500/20 opacity-70 blur-2xl" />

      {/* Main container */}
      <div className="border-border/60 bg-background/5 relative mt-8 overflow-hidden rounded-xl border shadow-2xl backdrop-blur-sm">
        {/* Mac chrome */}
        <div className="bg-muted/80 flex h-8 w-full items-center gap-1.5 px-4">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <div className="bg-background/60 ml-2 h-5 w-48 rounded-full" />
        </div>

        {/* Image */}
        <div className="group relative overflow-hidden object-cover p-1">
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
          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-1500 ease-in-out group-hover:translate-x-full group-hover:opacity-30" />
        </div>
      </div>

      {/* Ambient glow */}
      <div className="bg-primary/20 absolute -top-12 -right-12 h-24 w-24 animate-pulse rounded-full blur-2xl" />
      <div className="absolute -bottom-12 -left-12 h-32 w-32 animate-pulse rounded-full bg-purple-500/20 blur-3xl" />
    </motion.div>
  );
}
