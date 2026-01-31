/**
 * =============================================================================
 * FORM HEADER COMPONENT
 * =============================================================================
 */

"use client";

import { motion } from "framer-motion";
import { FolderGit } from "lucide-react";
import { cn } from "@/lib/utils";
import { HEADER_ICON_ANIMATION } from "../add-repo.constants";

export function FormHeader() {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-4">
        <motion.div
          {...HEADER_ICON_ANIMATION}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl",
            "bg-gradient-to-br from-primary/20 to-violet-500/20",
            "text-primary shadow-lg shadow-primary/10",
          )}
        >
          <FolderGit className="h-7 w-7" />
        </motion.div>
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="text-2xl font-bold text-foreground"
          >
            Add Repository
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="text-sm text-muted-foreground"
          >
            Connect your GitHub repository for AI-powered analysis
          </motion.p>
        </div>
      </div>
    </div>
  );
}
