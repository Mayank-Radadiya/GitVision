"use client";

/**
 * Empty state — shown when user has no projects.
 * Clean CTA to connect a repository.
 */

import { memo } from "react";
import { useRouter } from "next/navigation";
import { FolderGit2, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { motion } from "framer-motion";

function EmptyState() {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/40 px-8 py-16 backdrop-blur-sm"
    >
      {/* Icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <FolderGit2 className="h-8 w-8 text-primary" />
      </div>

      {/* Heading */}
      <h3 className="text-xl font-semibold text-foreground">No projects yet</h3>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground leading-relaxed">
        Connect a GitHub repository to unlock commit history, collaboration
        patterns, and AI-powered code insights.
      </p>

      {/* CTA */}
      <Button
        onClick={() => router.push("/dashboard/create-project")}
        className="mt-8 gap-2 rounded-xl px-6 py-2.5 font-semibold shadow-lg shadow-primary/20"
        aria-label="Connect a new repository"
      >
        <Plus className="h-4 w-4" />
        Connect Repository
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </motion.div>
  );
}

export default memo(EmptyState);
