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
      className="border-border/50 bg-card/40 flex flex-col items-center justify-center rounded-2xl border border-dashed px-8 py-16 backdrop-blur-sm"
    >
      {/* Icon */}
      <div className="bg-primary/10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl">
        <FolderGit2 className="text-primary h-8 w-8" />
      </div>

      {/* Heading */}
      <h3 className="text-foreground text-xl font-semibold">No projects yet</h3>
      <p className="text-muted-foreground mt-2 max-w-sm text-center text-sm leading-relaxed">
        Connect a GitHub repository to unlock commit history, collaboration
        patterns, and AI-powered code insights.
      </p>

      {/* CTA */}
      <Button
        onClick={() => router.push("/dashboard/create-project")}
        className="shadow-primary/20 mt-8 gap-2 rounded-xl px-6 py-2.5 font-semibold shadow-lg"
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
