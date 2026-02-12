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
        className="mb-6 inline-flex items-center rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-sm backdrop-blur-sm shadow-sm"
      >
        <span className="mr-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground dark:text-white/80">
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
        className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl !leading-[1.1]"
      >
        <span className="text-foreground">Understand GitHub</span>
        <br />
        <span className="text-foreground">Repositories </span>
        <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent animate-shimmer-text">
          with AI
        </span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        variants={fadeInUpVariants}
        initial="hidden"
        animate="visible"
        custom={0.2}
        className="mb-10 text-xl text-muted-foreground"
      >
        Get instant AI-powered insights into any public GitHub repository.
        <br className="hidden md:inline" /> Understand code changes, contributor
        patterns, and development history.
      </motion.p>
    </>
  );
}
