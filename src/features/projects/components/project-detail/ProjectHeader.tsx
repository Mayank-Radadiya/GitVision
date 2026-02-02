"use client";

import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ArrowLeft, ExternalLink, GitBranch } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo } from "react";

interface ProjectHeaderProps {
  isLoading: boolean;
  projectName?: string;
  githubUrl?: string;
}

const ProjectHeader = ({
  isLoading,
  projectName,
  githubUrl,
}: ProjectHeaderProps) => {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6 max-w-screen-2xl mx-auto">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 hover:bg-background/80 group transition-all duration-200 cursor-pointer"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="font-[family-name:var(--font-fira-sans)]">
            Back to Dashboard
          </span>
        </Button>
      </div>

      {/* Enhanced Glassmorphism Project Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 shadow-lg hover:shadow-xl transition-all duration-300 group">
        {/* Glassmorphism Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background/80 to-secondary/5 backdrop-blur-xl" />

        {/* Subtle Pattern Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.05),transparent_50%)]" />

        {/* Content */}
        <div className="relative p-8 md:p-10">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-8 sm:gap-6">
            {/* Project Info */}
            <div className="space-y-4 flex-1">
              {isLoading ? (
                <Skeleton className="h-12 w-64 mb-3" />
              ) : (
                <h1 className="text-4xl md:text-5xl font-bold font-[family-name:var(--font-fira-code)] tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                  {projectName || "Project Details"}
                </h1>
              )}

              {isLoading ? (
                <Skeleton className="h-6 w-80" />
              ) : (
                <Link
                  href={githubUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 text-muted-foreground hover:text-primary transition-all duration-200 group/link cursor-pointer font-[family-name:var(--font-fira-sans)]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/80 group-hover/link:bg-primary/10 transition-all duration-200 backdrop-blur-sm">
                    <ExternalLink className="h-4 w-4 group-hover/link:scale-110 transition-transform duration-200" />
                  </div>
                  <span className="truncate max-w-[350px] md:max-w-[500px] text-sm md:text-base group-hover/link:underline underline-offset-4">
                    {githubUrl?.replace(
                      /^https?:\/\/(www\.)?github\.com\//,
                      "",
                    ) || ""}
                  </span>
                </Link>
              )}
            </div>

            {/* CTA Button with Orange Accent */}
            {!isLoading && (
              <Button
                variant="outline"
                size="lg"
                className="gap-2.5 px-6 py-6 bg-gradient-to-br from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#F97316] border-0 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:-translate-y-0.5 font-[family-name:var(--font-fira-sans)]"
                asChild
              >
                <Link
                  href={githubUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GitBranch className="h-4 w-4" />
                  View Repository
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Subtle Bottom Glow */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>
    </div>
  );
};

export default memo(ProjectHeader);
