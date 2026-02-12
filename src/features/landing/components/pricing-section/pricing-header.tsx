import { motion } from "framer-motion";

interface PricingHeaderProps {
  isInView: boolean;
}

export function PricingHeader({ isInView }: PricingHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
      className="text-center mb-4"
    >
      <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-5">
        Simple,{" "}
        <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
          transparent
        </span>{" "}
        pricing
      </h2>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
        Start free and scale as your team grows. All plans include core analysis
        features.
      </p>
    </motion.div>
  );
}
