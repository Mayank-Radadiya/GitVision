import { motion } from "framer-motion";
import { fadeInUpVariants } from "./variants";

export function HeroContent() {
  return (
    <>
      {/* Announcement pill */}
      <motion.div
        variants={fadeInUpVariants}
        initial="hidden"
        animate="visible"
        custom={0}
        className="border-border/60 bg-background/80 mb-6 inline-flex items-center rounded-full border px-4 py-1.5 text-sm shadow-sm backdrop-blur-sm"
      >
        <span className="bg-primary text-primary-foreground mr-2 rounded-full px-2 py-0.5 text-xs font-semibold dark:text-white/80">
          New
        </span>
        <span className="text-muted-foreground">
          Introducing AI-powered commit analysis
        </span>
      </motion.div>

      {/* Shimmer headline */}
      <motion.h1
        variants={fadeInUpVariants}
        initial="hidden"
        animate="visible"
        custom={0.1}
        className="mb-6 text-4xl leading-[1.1]! font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
      >
        <span className="text-foreground">Understand GitHub</span>
        <br />
        <span className="text-foreground">Repositories </span>
        <span className="from-primary to-primary animate-shimmer-text bg-linear-to-r via-blue-400 bg-clip-text text-transparent">
          with AI
        </span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        variants={fadeInUpVariants}
        initial="hidden"
        animate="visible"
        custom={0.2}
        className="text-muted-foreground mb-10 text-xl"
      >
        Get instant AI-powered insights into any public GitHub repository.
        <br className="hidden md:inline" /> Understand code changes, contributor
        patterns, and development history.
      </motion.p>
    </>
  );
}
