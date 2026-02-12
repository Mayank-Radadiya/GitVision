import { motion } from "framer-motion";
import { floatingAnimation } from "./variants";

interface FloatingBadgeProps {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  className?: string;
  delay?: number;
}

export function FloatingBadge({
  icon: Icon,
  text,
  className = "",
  delay = 0,
}: FloatingBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={`absolute z-20 hidden lg:flex ${className}`}
    >
      <motion.div
        initial="initial"
        animate="animate"
        variants={floatingAnimation}
        className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/80 backdrop-blur-md px-3 py-2 shadow-lg"
      >
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground/80">{text}</span>
      </motion.div>
    </motion.div>
  );
}
