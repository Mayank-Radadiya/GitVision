/**
 * =============================================================================
 * INFO CARDS COMPONENT
 * =============================================================================
 */

"use client";

import { motion } from "framer-motion";
import { Zap, Link2 } from "lucide-react";

export function InfoCards() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.8 }}
      className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-accent/20 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            AI-Powered Analysis
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get insights on code quality, dependencies, and contributors
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-accent/20 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
          <Link2 className="h-4 w-4 text-violet-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Real-time Sync</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically syncs with your GitHub repository
          </p>
        </div>
      </div>
    </motion.div>
  );
}
