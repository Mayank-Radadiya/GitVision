"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { SearchIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { fadeInUpVariants } from "./variants";

export function HeroSearchForm() {
  const [repoUrl, setRepoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setRepoUrl(e.target.value),
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!repoUrl) return;
      setIsSubmitting(true);
      setTimeout(() => setIsSubmitting(false), 1000);
    },
    [repoUrl],
  );

  return (
    <motion.div
      variants={fadeInUpVariants}
      initial="hidden"
      animate="visible"
      custom={0.3}
      className="mx-auto mb-10 max-w-md"
    >
      <form className="relative" onSubmit={handleSubmit}>
        <SearchIcon className="absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Paste GitHub repository URL"
          className="pl-9 pr-24 h-12 rounded-full border-border/60 bg-transparent shadow-sm focus:ring-2 focus:ring-primary/40 transition-all"
          value={repoUrl}
          onChange={handleChange}
          aria-label="GitHub repository URL"
        />
        <Button
          type="submit"
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full h-10 bg-primary hover:bg-primary/90 transition-all duration-300 cursor-pointer"
          disabled={!repoUrl.trim() || isSubmitting}
          aria-label="Analyze repository"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-white/80 animate-ping" />
              Analyzing...
            </span>
          ) : (
            "Analyze"
          )}
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        Example: https://github.com/vercel/next.js
      </p>
    </motion.div>
  );
}
