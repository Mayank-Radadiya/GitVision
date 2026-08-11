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
      className="mx-auto mb-20 max-w-3xl text-center"
    >
      <div className="border-border/50 bg-background/80 mb-5 inline-flex items-center rounded-full border px-4 py-1.5 text-sm backdrop-blur-sm">
        <span className="bg-primary/10 mr-2.5 rounded-full p-1">
          <BrainCircuitIcon className="text-primary h-3.5 w-3.5" />
        </span>
        <span className="text-muted-foreground">Powered by advanced AI</span>
      </div>

      <h2 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
        Everything you need to
        <br />
        <span className="from-primary to-primary bg-linear-to-r via-blue-400 bg-clip-text text-transparent">
          understand your code
        </span>
      </h2>

      <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed">
        Deep analysis of GitHub repositories — code changes, contributor
        patterns, and development history with unprecedented clarity.
      </p>
    </motion.div>
  );
}
