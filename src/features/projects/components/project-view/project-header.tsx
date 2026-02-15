"use client";

/**
 * Project Header — Displays project name, GitHub link, and back navigation.
 * Props-driven: receives project data from parent, no internal data fetching.
 * Memo'd to prevent rerenders from sibling state changes.
 */

import { memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, GitBranch } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface ProjectHeaderProps {
  projectName: string | undefined;
  githubUrl: string | undefined;
  isLoading: boolean;
}

/** Extracts "owner/repo" from a full GitHub URL */
function extractRepoPath(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "");
}

function ProjectHeader({
  projectName,
  githubUrl,
  isLoading,
}: ProjectHeaderProps) {
  const router = useRouter();
  const repoPath = githubUrl ? extractRepoPath(githubUrl) : "";
  const cleanUrl = githubUrl?.replace(/\.git$/, "") || "";

  return (
    <div className="space-y-5">
      {/* Back Navigation */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard")}
        className="gap-2 text-muted-foreground hover:text-foreground group cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
        Back to Dashboard
      </Button>

      {/* Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/80 backdrop-blur-xl shadow-lg">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="relative p-8 md:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            {/* Project Info */}
            <div className="space-y-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-10 w-64" />
                  <Skeleton className="h-5 w-80" />
                </>
              ) : (
                <>
                  <motion.h1
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl font-bold tracking-tight text-foreground md:text-4xl"
                  >
                    {projectName || "Project Details"}
                  </motion.h1>

                  {githubUrl && (
                    <Link
                      href={cleanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 text-sm text-muted-foreground hover:text-primary transition-colors group/link cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="truncate max-w-[400px] group-hover/link:underline underline-offset-4">
                        {repoPath}
                      </span>
                    </Link>
                  )}
                </>
              )}
            </div>

            {/* View Repo CTA */}
            {!isLoading && githubUrl && (
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-br from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#F97316] border-0 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
                asChild
              >
                <Link href={cleanUrl} target="_blank" rel="noopener noreferrer">
                  <GitBranch className="h-4 w-4" />
                  View Repository
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ProjectHeader);
