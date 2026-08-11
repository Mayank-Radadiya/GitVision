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
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Paste GitHub repository URL"
          className="border-border/60 focus:ring-primary/40 h-12 rounded-full bg-transparent pr-24 pl-9 shadow-sm transition-all focus:ring-2"
          value={repoUrl}
          onChange={handleChange}
          aria-label="GitHub repository URL"
        />
        <Button
          type="submit"
          className="bg-primary hover:bg-primary/90 absolute top-1/2 right-1 h-10 -translate-y-1/2 cursor-pointer rounded-full transition-all duration-300"
          disabled={!repoUrl.trim() || isSubmitting}
          aria-label="Analyze repository"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-ping rounded-full bg-white/80" />
              Analyzing...
            </span>
          ) : (
            "Analyze"
          )}
        </Button>
      </form>
      <p className="text-muted-foreground mt-2 text-xs">
        Example: https://github.com/vercel/next.js
      </p>
    </motion.div>
  );
}
