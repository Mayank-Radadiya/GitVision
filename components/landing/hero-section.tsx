"use client";

import { useState, useCallback, memo } from "react";
import Link from "next/link";
import { motion, LazyMotion, domAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { SparklesCore } from "../animation/sparkles";
import Image from "next/image";
import { GlowingButton } from "../custom/glowing-button";

// Animation variants to reduce repetition
const fadeInUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay },
  }),
};

// Memoize static components for better performance
const MemoizedSparklesCore = memo(SparklesCore);

// Extract gradient effect for reuse
const GradientBackground = memo(() => (
  <>
    <div className="absolute -left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px] dark:bg-primary/20"></div>
    <div className="absolute -right-1/4 bottom-0 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px] dark:bg-primary/20"></div>
  </>
));
GradientBackground.displayName = "GradientBackground";

export function HeroSection() {
  const [repoUrl, setRepoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRepoUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRepoUrl(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!repoUrl) return;

      setIsSubmitting(true);
      // Mock submission - would be connected to real logic
      setTimeout(() => {
        setIsSubmitting(false);
        // Handle repository analysis logic here
      }, 1000);
    },
    [repoUrl]
  );

  // Use LazyMotion to load Framer Motion features only when needed
  return (
    <LazyMotion features={domAnimation}>
      <section className="relative overflow-hidden bg-grid-small-black/[0.2] dark:bg-grid-small-white/[0.05] pt-32 pb-24">
        <div className="absolute inset-0 bg-grid-small-black/[0.15] dark:bg-grid-small-white/[0.05]"></div>
        <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>

        {/* Optimized gradient background */}
        <GradientBackground />

        {/* Radial gradient for the container to give a faded look */}
        <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>

        {/* Sparkles effect - memoized to prevent unnecessary re-renders */}
        <div className="absolute inset-0 h-full w-full">
          <MemoizedSparklesCore
            id="tsparticlesfullpage"
            background="transparent"
            minSize={0.6}
            maxSize={1.4}
            particleDensity={100}
            className="h-full w-full"
            particleColor="#7928CA"
          />
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              variants={fadeInUpVariants}
              initial="hidden"
              animate="visible"
              custom={0}
              className="mb-6 inline-flex items-center rounded-full border border-border bg-background/80 px-4 py-1.5 text-sm backdrop-blur-sm"
            >
              <span className="mr-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground dark:text-white/80">
                New
              </span>
              <span className="text-muted-foreground">
                Introducing AI-powered commit analysis
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUpVariants}
              initial="hidden"
              animate="visible"
              custom={0.1}
              className="mb-6 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-6xl lg:text-7xl"
            >
              Understand GitHub Repositories with AI
            </motion.h1>

            <motion.p
              variants={fadeInUpVariants}
              initial="hidden"
              animate="visible"
              custom={0.2}
              className="mb-10 text-xl text-muted-foreground"
            >
              Get instant AI-powered insights into any public GitHub repository.
              <br className="hidden md:inline" /> Understand code changes,
              contributor patterns, and development history.
            </motion.p>

            <motion.div
              variants={fadeInUpVariants}
              initial="hidden"
              animate="visible"
              custom={0.3}
              className="mx-auto mb-10 max-w-md"
            >
              <form className="relative" onSubmit={handleSubmit}>
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Paste GitHub repository URL"
                  className="pl-9 pr-24 h-12 rounded-full"
                  value={repoUrl}
                  onChange={handleRepoUrlChange}
                  aria-label="GitHub repository URL"
                />
                <Button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-10"
                  disabled={!repoUrl.trim() || isSubmitting}
                  aria-label="Analyze repository"
                >
                  {isSubmitting ? "Analyzing..." : "Analyze"}
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">
                Example: https://github.com/vercel/next.js.git
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUpVariants}
              initial="hidden"
              animate="visible"
              custom={0.4}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Link href="/sign-up" aria-label="Sign up for free access">
                <GlowingButton className="rounded-full gap-2 group">
                  Get started for free
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </GlowingButton>
              </Link>
              <Link href="#demo" aria-label="View demo">
                <Button variant="outline" size="lg" className="rounded-full">
                  See how it works
                </Button>
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative hidden lg:block items-center justify-center"
          >
            {/* Outer gradient glow */}
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/30 via-purple-500/20 to-primary/30 blur-2xl opacity-70" />

            {/* Main container */}
            <div className="relative overflow-hidden rounded-xl border shadow-2xl bg-background/5 backdrop-blur-sm mt-16">
              {/* Top bar (Mac-style) */}
              <div className="h-8 w-full bg-muted/80 flex items-center px-4 gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <div className="ml-2 h-5 w-48 rounded-full bg-background/60" />
              </div>

              {/* Image content */}
              <div className="relative p-1 object-cover">
                <Image
                  src="/hero2.jpg"
                  width={1250}
                  height={650}
                  alt="GitVision Dashboard Preview"
                  className="rounded-lg shadow-sm transition-all duration-300 hover:brightness-105"
                  priority
                  sizes="(max-width: 1023px) 100vw, 1250px"
                />
                {/* Grid overlay for subtle texture */}
                <div className="absolute inset-0 bg-grid-small-black/[0.02] dark:bg-grid-small-white/[0.02] rounded-lg mix-blend-overlay" />
              </div>
            </div>

            {/* Ambient background glow circles */}
            <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
            <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-purple-500/20 blur-3xl" />
          </motion.div>
        </div>
      </section>
    </LazyMotion>
  );
}
