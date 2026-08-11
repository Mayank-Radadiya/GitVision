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
        className="border-border/40 bg-background/80 flex items-center gap-2 rounded-lg border px-3 py-2 shadow-lg backdrop-blur-md"
      >
        <Icon className="text-primary h-3.5 w-3.5" />
        <span className="text-foreground/80 text-xs font-medium">{text}</span>
      </motion.div>
    </motion.div>
  );
}
