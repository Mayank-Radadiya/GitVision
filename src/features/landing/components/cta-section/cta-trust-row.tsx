import { motion } from "framer-motion";
import { TRUST_SIGNALS } from "./constants";

interface CtaTrustRowProps {
  isInView: boolean;
}

export function CtaTrustRow({ isInView }: CtaTrustRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground/60"
    >
      {TRUST_SIGNALS.map((signal, i) => (
        <span key={signal} className="flex items-center gap-x-6">
          <span>{signal}</span>
          {i < TRUST_SIGNALS.length - 1 && (
            <span className="text-border" aria-hidden="true">
              ·
            </span>
          )}
        </span>
      ))}
    </motion.div>
  );
}
