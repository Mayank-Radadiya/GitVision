"use client";

import { useRef, memo } from "react";
import { motion, useInView } from "framer-motion";
import {
  GitBranchIcon,
  MessageSquareIcon,
  BarChart3Icon,
  UsersIcon,
  SearchIcon,
  ZapIcon,
  BrainCircuitIcon,
  CodeIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

const features = [
  {
    name: "Commit Intelligence",
    description:
      "Our AI analyzes commit patterns, code changes, and development history to provide meaningful insights.",
    icon: GitBranchIcon,
    color:
      "from-blue-600/20 via-blue-400/20 to-cyan-500/20 dark:from-blue-600/20 dark:via-blue-400/15 dark:to-cyan-500/10",
    borderColor: "border-blue-500/20 dark:border-blue-400/20",
  },
  {
    name: "ChatGit Interface",
    description:
      "Ask questions about any repository and get instant, AI-powered answers about code changes and patterns.",
    icon: MessageSquareIcon,
    color:
      "from-purple-600/20 via-purple-400/20 to-pink-500/20 dark:from-purple-600/20 dark:via-purple-400/15 dark:to-pink-500/10",
    borderColor: "border-purple-500/20 dark:border-purple-400/20",
  },
  {
    name: "Visual Analytics",
    description:
      "See beautiful visualizations of contributor activity, code changes over time, and development trends.",
    icon: BarChart3Icon,
    color:
      "from-amber-600/20 via-amber-400/20 to-orange-500/20 dark:from-amber-600/20 dark:via-amber-400/15 dark:to-orange-500/10",
    borderColor: "border-amber-500/20 dark:border-amber-400/20",
  },
  {
    name: "Team Insights",
    description:
      "Understand who's contributing what, identify key developers, and track team productivity over time.",
    icon: UsersIcon,
    color:
      "from-green-600/20 via-green-400/20 to-emerald-500/20 dark:from-green-600/20 dark:via-green-400/15 dark:to-emerald-500/10",
    borderColor: "border-green-500/20 dark:border-green-400/20",
  },
  {
    name: "Smart Code Search",
    description:
      "Quickly find and understand specific code changes across the entire repository history with AI assistance.",
    icon: SearchIcon,
    color:
      "from-rose-600/20 via-rose-400/20 to-red-500/20 dark:from-rose-600/20 dark:via-rose-400/15 dark:to-red-500/10",
    borderColor: "border-rose-500/20 dark:border-rose-400/20",
  },
  {
    name: "Performance Metrics",
    description:
      "Track development velocity, code quality trends, and project health metrics with intuitive dashboards.",
    icon: ZapIcon,
    color:
      "from-indigo-600/20 via-indigo-400/20 to-violet-500/20 dark:from-indigo-600/20 dark:via-indigo-400/15 dark:to-violet-500/10",
    borderColor: "border-indigo-500/20 dark:border-indigo-400/20",
  },
];

function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20,
        duration: 0.5,
      },
    },
  };

  return (
    <section id="features" ref={ref} className="py-32 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-grid-small-black/[0.2] dark:bg-grid-small-white/[0.05]"></div>
      <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>

      {/* Ambient gradient orbs */}
      <div className="absolute -left-1/4 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px] dark:bg-primary/10"></div>
      <div className="absolute -right-1/4 bottom-1/3 h-[500px] w-[500px] rounded-full bg-purple-500/5 blur-[120px] dark:bg-purple-500/10"></div>
      <div className="absolute left-1/3 bottom-0 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[80px] dark:bg-blue-500/10"></div>

      <div className="container relative px-4 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{
            type: "spring",
            stiffness: 50,
            damping: 20,
            duration: 0.8,
          }}
          className="max-w-3xl mx-auto text-center mb-24"
        >
          <div className="mb-6 inline-flex items-center rounded-full border border-border bg-background/80 px-4 py-1.5 text-sm backdrop-blur-sm">
            <span className="mr-2.5 rounded-full bg-primary/10 p-1">
              <BrainCircuitIcon className="h-3.5 w-3.5 text-primary" />
            </span>
            <span className="text-muted-foreground">
              Powered by advanced AI technology
            </span>
          </div>

          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-8 bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
            Transform your development workflow
          </h2>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            GitVision provides deep analysis of GitHub repositories, helping you
            understand code changes, contributor patterns, and development
            history with unprecedented clarity.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.name}
              variants={itemVariants}
              className="group relative h-full"
            >
              {/* Background glow effect */}
              <div
                className={cn(
                  "absolute inset-0 rounded-3xl bg-gradient-to-br blur-xl opacity-50 transition-all duration-500 group-hover:opacity-80",
                  feature.color
                )}
              />

              {/* Card content */}
              <div
                className={cn(
                  "relative h-full rounded-3xl border bg-background/80 backdrop-blur-md p-8 transition-all duration-300 group-hover:shadow-xl group-hover:bg-background/95 group-hover:scale-[1.02]",
                  feature.borderColor
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm",
                    feature.color
                  )}
                >
                  <feature.icon className="h-8 w-8" />
                </div>

                {/* Title */}
                <h3 className="mb-4 text-2xl font-bold">{feature.name}</h3>

                {/* Description */}
                <p className="text-muted-foreground text-lg leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{
            type: "spring",
            stiffness: 50,
            damping: 20,
            duration: 0.8,
            delay: 0.6,
          }}
          className="mt-24 text-center"
        >
          <div className="inline-flex items-center justify-center gap-3 rounded-full border border-border bg-background/90 px-6 py-3 text-sm backdrop-blur-sm shadow-sm">
            <CodeIcon className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground font-medium">
              Join thousands of developers who trust GitVision for their
              repository insights
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default memo(FeaturesSection);