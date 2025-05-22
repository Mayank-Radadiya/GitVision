"use client";

import { GradientHeading } from "@/components/custom/gradient-heading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="flex flex-col gap-4 max-w-screen-2xl mx-auto">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 hover:bg-background/80 group"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Button>
      </div>

      {/* Project Header */}
      <div className="bg-gradient-to-r from-background via-muted/20 to-background rounded-lg p-6 border border-border/30 shadow-sm mb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 sm:gap-4">
          <div className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-10 w-48 mb-2" />
            ) : (
              <GradientHeading as="h1" className="mb-2">
                {projectName || "Project Details"}
              </GradientHeading>
            )}

            {isLoading ? (
              <Skeleton className="h-6 w-64" />
            ) : (
              <Link
                href={githubUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground flex items-center gap-2 hover:text-primary transition-colors group"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 group-hover:bg-muted transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
                <span className="truncate max-w-[350px]">
                  {githubUrl?.replace(
                    /^https?:\/\/(www\.)?github\.com\//,
                    ""
                  ) || ""}
                </span>
              </Link>
            )}
          </div>

          {!isLoading && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hover:bg-primary/10 border-primary/30 text-primary hover:text-primary"
              asChild
            >
              <Link
                href={githubUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitBranch className="h-3.5 w-3.5" />
                View Repository
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ProjectHeader);
