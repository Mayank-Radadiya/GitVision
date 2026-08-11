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
      className="mb-4 text-center"
    >
      <h2 className="mb-5 text-4xl font-bold tracking-tight sm:text-5xl">
        Simple,{" "}
        <span className="from-primary to-primary bg-linear-to-r via-blue-400 bg-clip-text text-transparent">
          transparent
        </span>{" "}
        pricing
      </h2>
      <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
        Start free and scale as your team grows. All plans include core analysis
        features.
      </p>
    </motion.div>
  );
}
