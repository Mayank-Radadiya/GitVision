import { motion } from "framer-motion";
import { FEATURES } from "./constants";
import { containerVariants } from "./variants";
import { FeatureCard } from "./feature-card";

interface FeaturesGridProps {
  isInView: boolean;
}

export function FeaturesGrid({ isInView }: FeaturesGridProps) {
  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.name} feature={feature} />
        ))}
      </motion.div>

      {/* Bottom tagline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="mt-16 text-center"
      >
        <p className="text-muted-foreground/60 text-sm">
          All features work with any public GitHub repository — no setup
          required.
        </p>
      </motion.div>
    </>
  );
}
