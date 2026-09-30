import { motion } from "framer-motion";
import { PLANS } from "./constants";
import { containerVariants } from "./variants";
import { PricingCard } from "./pricing-card";

interface PricingGridProps {
  isInView: boolean;
}

export function PricingGrid({ isInView }: PricingGridProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      className="mt-12 grid grid-cols-1 items-stretch gap-6 md:grid-cols-3"
    >
      {PLANS.map((plan) => (
        <PricingCard key={plan.name} plan={plan} />
      ))}
    </motion.div>
  );
}
