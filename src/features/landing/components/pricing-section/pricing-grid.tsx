import { motion } from "framer-motion";
import { Button } from "@/shared/components/ui/button";
import { PLANS } from "./constants";
import { containerVariants } from "./variants";
import { PricingCard } from "./pricing-card";

interface PricingGridProps {
  isInView: boolean;
}

export function PricingGrid({ isInView }: PricingGridProps) {
  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 items-stretch"
      >
        {PLANS.map((plan) => (
          <PricingCard key={plan.name} plan={plan} />
        ))}
      </motion.div>

      {/* Enterprise CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-14 text-center"
      >
        <p className="text-sm text-muted-foreground">
          Need a custom solution for your enterprise?{" "}
          <Button
            variant="link"
            className="text-primary h-auto p-0 pl-0.5 cursor-pointer"
          >
            Contact our sales team
          </Button>
        </p>
      </motion.div>
    </>
  );
}
