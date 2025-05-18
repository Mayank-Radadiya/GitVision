"use client";

import { useState, useCallback, memo, useEffect } from "react";
import Link from "next/link";
import {
  motion,
  LazyMotion,
  domAnimation,
  useScroll,
  useTransform,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRightIcon, SearchIcon, GithubIcon, Star } from "lucide-react";
import { SparklesCore } from "../animation/sparkles";
import Image from "next/image";
import { GlowingButton } from "../custom/glowing-button";

// Animation variants to reduce repetition
const fadeInUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay, ease: "easeOut" },
  }),
};

// Floating animation for elements
const floatingAnimation = {
  initial: { y: 0 },
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      repeatType: "reverse" as const,
      ease: "easeInOut",
    },
  },
};

// Memoize static components for better performance
const MemoizedSparklesCore = memo(SparklesCore);

// Pulsing gradient effect component
const PulsingGradient = memo(() => (
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute -left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-gradient-to-r from-primary/20 to-purple-500/20 blur-[120px] dark:from-primary/30 dark:to-purple-600/30 animate-pulse-slow"></div>
    <div className="absolute -right-1/4 bottom-0 h-[600px] w-[600px] rounded-full bg-gradient-to-r from-blue-500/20 to-primary/20 blur-[120px] dark:from-blue-600/30 dark:to-primary/30 animate-pulse-slow animation-delay-2000"></div>
    <div className="absolute left-1/3 top-1/3 h-[300px] w-[300px] rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-[120px] dark:from-cyan-500/30 dark:to-blue-500/30 animate-pulse-slow animation-delay-4000"></div>
  </div>
));
PulsingGradient.displayName = "PulsingGradient";

// interface AnimatedStatProps {
//   label: string;
//   value: string;
//   delay?: number;
// }
// Animated statistic component
// const AnimatedStat = ({ label, value, delay = 0 }: AnimatedStatProps) => (
//   <motion.div
//     initial={{ opacity: 0, y: 20 }}
//     animate={{ opacity: 1, y: 0 }}
//     transition={{ duration: 0.5, delay }}
//     className="flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-sm"
//   >
//     <motion.span
//       initial={{ opacity: 0, scale: 0.9 }}
//       animate={{ opacity: 1, scale: 1 }}
//       transition={{ duration: 0.5, delay: delay + 0.2 }}
//       className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent"
//     >
//       {value}
//     </motion.span>
//     <span className="text-xs text-muted-foreground mt-1">{label}</span>
//   </motion.div>
// );

// Floating GitHub badge
const GitHubBadge = ({ className = "" }) => (
  <motion.div
    initial="initial"
    animate="animate"
    variants={floatingAnimation}
    className={`absolute z-20 flex items-center space-x-2 bg-background/80 backdrop-blur-md border border-border/50 rounded-full px-3 py-1.5 shadow-lg ${className}`}
  >
    <GithubIcon className="h-4 w-4 text-foreground" />
    <span className="text-xs font-medium">10k+ Stars on GitHub</span>
    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
  </motion.div>
);

function HeroSection() {
  const [repoUrl, setRepoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFloatingElements, setShowFloatingElements] = useState(false);

  // Parallax effect for hero image
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 50]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0.5]);

  // Show floating elements after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFloatingElements(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

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
      <section className="relative overflow-hidden bg-grid-small-black/[0.2] dark:bg-grid-small-white/[0.05] pt-32 pb-24 min-h-screen flex flex-col justify-center">
        <div className="absolute inset-0 bg-grid-small-black/[0.15] dark:bg-grid-small-white/[0.05]"></div>
        <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>

        {/* Enhanced gradient background with animation */}
        <PulsingGradient />

        {/* Radial gradient for the container to give a faded look */}
        <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>

        {/* Improved sparkles effect with more variations */}
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

        {/* Optional floating GitHub badge - appears after delay */}
        {showFloatingElements && (
          <GitHubBadge className="top-24 right-8 lg:right-24" />
        )}

        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
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

            <motion.h1
              variants={fadeInUpVariants}
              initial="hidden"
              animate="visible"
              custom={0.1}
              className="mb-6 bg-gradient-to-r from-foreground via-primary/90 to-foreground/90 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-6xl lg:text-7xl"
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
                <SearchIcon className="absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Paste GitHub repository URL"
                  className="pl-9 pr-24 h-12 rounded-full border-border/60 bg-transparent shadow-sm focus:ring-2 focus:ring-primary/40 transition-all"
                  value={repoUrl}
                  onChange={handleRepoUrlChange}
                  aria-label="GitHub repository URL"
                />
                <Button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-10 bg-primary hover:bg-primary/90 transition-all duration-300"
                  disabled={!repoUrl.trim() || isSubmitting}
                  aria-label="Analyze repository"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-white/80 animate-ping"></span>
                      Analyzing...
                    </span>
                  ) : (
                    "Analyze"
                  )}
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
                <GlowingButton className="rounded-full gap-2 group z-12">
                  Get started for free
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </GlowingButton>
              </Link>
              <Link href="#demo" aria-label="View demo">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-border/60 bg-background/60 backdrop-blur-sm hover:bg-background/80 transition-all duration-300"
                >
                  See how it works
                </Button>
              </Link>
            </motion.div>

            {/* Stats section */}
            {/* {showFloatingElements && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="grid grid-cols-3 gap-3 mt-12 max-w-lg mx-auto"
              >
                <AnimatedStat label="Repositories" value="10M+" delay={0.9} />
                <AnimatedStat label="Users" value="100K+" delay={1.0} />
                <AnimatedStat label="Insights" value="500M+" delay={1.1} />
              </motion.div>
            )} */}
          </div>

          <motion.div
            style={{ y, opacity }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="relative hidden lg:block items-center justify-center mt-10"
          >
            {/* Floating insights badge */}
            {showFloatingElements && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.4 }}
                className="absolute -right-20 -top-5 z-20 bg-background/80 backdrop-blur-md border border-border/50 rounded-lg px-3 py-2 shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-xs font-medium">
                    AI analyzing commit patterns
                  </span>
                </div>
              </motion.div>
            )}

            {/* Outer gradient glow with animation */}
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/30 via-purple-500/20 to-primary/30 blur-2xl opacity-70 animate-pulse-slow" />

            {/* Main container */}
            <div className="relative overflow-hidden rounded-xl border border-border/60 shadow-2xl bg-background/5 backdrop-blur-sm mt-16">
              {/* Top bar (Mac-style) */}
              <div className="h-8 w-full bg-muted/80 flex items-center px-4 gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <div className="ml-2 h-5 w-48 rounded-full bg-background/60" />
              </div>

              {/* Image content with interactive hover effect */}
              <div className="relative p-1 object-cover overflow-hidden group">
                <Image
                  src="/hero2.jpg"
                  width={1250}
                  height={650}
                  alt="GitVision Dashboard Preview"
                  className="rounded-lg shadow-sm transition-all duration-700 group-hover:scale-[1.02] group-hover:brightness-105"
                  priority
                  sizes="(max-width: 1023px) 100vw, 1250px"
                />
                {/* Grid overlay for subtle texture */}
                <div className="absolute inset-0 bg-grid-small-black/[0.02] dark:bg-grid-small-white/[0.02] rounded-lg mix-blend-overlay" />

                {/* Subtle shine effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-30 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-1500 ease-in-out" />
              </div>
            </div>

            {/* Enhanced ambient background glow circles with animation */}
            <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-primary/20 blur-2xl animate-pulse-slow" />
            <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-purple-500/20 blur-3xl animate-pulse-slow animation-delay-2000" />
          </motion.div>
        </div>
      </section>
    </LazyMotion>
  );
}

export default memo(HeroSection);
