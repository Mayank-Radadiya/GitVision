import { motion } from "framer-motion";
import { BrainCircuitIcon } from "lucide-react";

interface FeaturesHeaderProps {
  isInView: boolean;
}

export function FeaturesHeader({ isInView }: FeaturesHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
      className="max-w-3xl mx-auto text-center mb-20"
    >
      <div className="mb-5 inline-flex items-center rounded-full border border-border/50 bg-background/80 px-4 py-1.5 text-sm backdrop-blur-sm">
        <span className="mr-2.5 rounded-full bg-primary/10 p-1">
          <BrainCircuitIcon className="h-3.5 w-3.5 text-primary" />
        </span>
        <span className="text-muted-foreground">Powered by advanced AI</span>
      </div>

      <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
        Everything you need to
        <br />
        <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
          understand your code
        </span>
      </h2>

      <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
        Deep analysis of GitHub repositories — code changes, contributor
        patterns, and development history with unprecedented clarity.
      </p>
    </motion.div>
  );
}
