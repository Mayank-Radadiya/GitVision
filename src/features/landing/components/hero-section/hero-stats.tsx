import { motion } from "framer-motion";
import { AnimatedCounter } from "./animated-counter";
import { STATS_DATA } from "./constants";
import { fadeInUpVariants } from "./variants";

export function HeroStats() {
  return (
    <motion.div
      variants={fadeInUpVariants}
      initial="hidden"
      animate="visible"
      custom={0.55}
      className="mt-14 grid grid-cols-3 gap-8 max-w-sm mx-auto"
    >
      {STATS_DATA.map((stat) => (
        <AnimatedCounter
          key={stat.label}
          value={stat.value}
          label={stat.label}
        />
      ))}
    </motion.div>
  );
}
