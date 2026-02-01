"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Calendar,
  Code,
  GitBranch,
  GitCommit,
  GitFork,
  Star,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { memo } from "react";
import { StatItem } from "./StatItem";
import { ProjectDetails } from "../types";

interface ProjectStatsProps {
  isLoading: boolean;
  project: ProjectDetails | null;
}

const ProjectStats = ({ isLoading, project }: ProjectStatsProps) => {
  return (
    <div className="max-w-screen-2xl mx-auto">
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        /* Bento-Style Asymmetric Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          {/* Repository Info - Larger Card (Spans 2 columns on large screens) */}
          <Card className="lg:col-span-2 border border-border/40 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card/95 via-card/90 to-card/80 backdrop-blur-xl overflow-hidden group cursor-pointer relative">
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <CardHeader className="pb-4 relative z-10">
              <CardTitle className="text-xl font-semibold flex items-center gap-3 font-[family-name:var(--font-fira-code)]">
                <div className="p-2.5 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-200">
                  <GitBranch className="h-6 w-6 text-primary" />
                </div>
                Repository Metrics
              </CardTitle>
            </CardHeader>

            <CardContent className="relative z-10">
              <div className="grid grid-cols-2 gap-6">
                <StatItem
                  icon={<Star className="h-5 w-5 text-[#F59E0B]" />}
                  label="Stars"
                  value={project?.star || 0}
                />
                <StatItem
                  icon={<GitFork className="h-5 w-5 text-[#3B82F6]" />}
                  label="Forks"
                  value={project?.forks || 0}
                />
                <StatItem
                  icon={<GitBranch className="h-5 w-5 text-[#10B981]" />}
                  label="Branches"
                  value={project?.totalBranches || 0}
                />
                <StatItem
                  icon={<Users className="h-5 w-5 text-[#F97316]" />}
                  label="Contributors"
                  value={project?.totalContributors || 0}
                />
              </div>
            </CardContent>

            {/* Bottom Border Accent */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />
          </Card>

          {/* Commit Activity - Tall Card */}
          <Card className="border border-border/40 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card/95 via-card/90 to-card/80 backdrop-blur-xl overflow-hidden group cursor-pointer relative">
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <CardHeader className="pb-4 relative z-10">
              <CardTitle className="text-xl font-semibold flex items-center gap-3 font-[family-name:var(--font-fira-code)]">
                <div className="p-2.5 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-xl group-hover:from-secondary/30 group-hover:to-secondary/20 transition-all duration-200">
                  <Activity className="h-6 w-6 text-secondary" />
                </div>
                Activity
              </CardTitle>
            </CardHeader>

            <CardContent className="relative z-10">
              <div className="space-y-6">
                <StatItem
                  icon={<GitCommit className="h-5 w-5 text-[#60A5FA]" />}
                  label="Total Commits"
                  value={project?.totalCommits || 0}
                />
                <StatItem
                  icon={<Calendar className="h-5 w-5 text-[#F97316]" />}
                  label="Created"
                  value={
                    project?.createdAt
                      ? format(new Date(project.createdAt), "MMM d, yyyy")
                      : "N/A"
                  }
                />
              </div>
            </CardContent>

            {/* Bottom Border Accent */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary/0 via-secondary/50 to-secondary/0" />
          </Card>

          {/* AI Analysis - Full Width on Mobile, Single Column on Desktop */}
          <Card className="lg:col-span-3 border border-border/40 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card/95 via-card/90 to-card/80 backdrop-blur-xl overflow-hidden group cursor-pointer relative">
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#F97316]/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <CardHeader className="pb-4 relative z-10">
              <CardTitle className="text-xl font-semibold flex items-center gap-3 font-[family-name:var(--font-fira-code)]">
                <div className="p-2.5 bg-gradient-to-br from-[#F97316]/20 to-[#F97316]/10 rounded-xl group-hover:from-[#F97316]/30 group-hover:to-[#F97316]/20 transition-all duration-200">
                  <Code className="h-6 w-6 text-[#F97316]" />
                </div>
                AI-Powered Analysis
              </CardTitle>
            </CardHeader>

            <CardContent className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-base text-muted-foreground leading-relaxed font-[family-name:var(--font-fira-sans)]">
                    GitVision has analyzed{" "}
                    <span className="font-bold text-foreground font-[family-name:var(--font-fira-code)]">
                      {project?.totalCommits?.toLocaleString() || 0}
                    </span>{" "}
                    commits in this repository, providing AI-powered insights,
                    summaries, and intelligent code analysis to help you
                    understand your project&#39;s evolution.
                  </p>
                </div>

                {/* Visual Accent */}
                <div className="hidden sm:block flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F97316]/20 to-[#F97316]/10 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center shadow-lg">
                      <span className="text-2xl font-bold text-white font-[family-name:var(--font-fira-code)]">
                        AI
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>

            {/* Bottom Border Accent */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#F97316]/0 via-[#F97316]/50 to-[#F97316]/0" />
          </Card>
        </div>
      )}
    </div>
  );
};

export default memo(ProjectStats);
