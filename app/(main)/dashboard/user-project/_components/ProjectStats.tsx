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
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Repository Info */}
          <Card className="border border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <GitBranch className="h-5 w-5 text-primary" />
                </div>
                Repository Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <StatItem
                  icon={<Star className="h-4 w-4 text-yellow-500" />}
                  label="Stars"
                  value={project?.star || 0}
                />
                <StatItem
                  icon={<GitFork className="h-4 w-4 text-indigo-500" />}
                  label="Forks"
                  value={project?.forks || 0}
                />
                <StatItem
                  icon={<GitBranch className="h-4 w-4 text-green-600" />}
                  label="Branches"
                  value={project?.totalBranches || 0}
                />
                <StatItem
                  icon={<Users className="h-4 w-4 text-purple-500" />}
                  label="Contributors"
                  value={project?.totalContributors || 0}
                />
              </div>
            </CardContent>
          </Card>

          {/* Commit Activity */}
          <Card className="border border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                Commit Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                <StatItem
                  icon={<GitCommit className="h-4 w-4 text-blue-500" />}
                  label="Total Commits"
                  value={project?.totalCommits || 0}
                />
                <StatItem
                  icon={<Calendar className="h-4 w-4 text-cyan-500" />}
                  label="Created"
                  value={
                    project?.createdAt
                      ? format(new Date(project.createdAt), "MMM d, yyyy")
                      : "N/A"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Analysis */}
          <Card className="border border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <Code className="h-5 w-5 text-primary" />
                </div>
                Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                <div className="text-muted-foreground">
                  GitVision has analyzed {project?.totalCommits || 0} commits in
                  this repository providing AI-powered insights and summaries.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default memo(ProjectStats);
