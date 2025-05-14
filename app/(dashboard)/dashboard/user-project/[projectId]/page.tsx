"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "@clerk/nextjs";
import { GradientHeading } from "@/components/custom/gradient-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

import {
  GitBranch,
  GitCommit,
  GitFork,
  Star,
  Users,
  Calendar,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  Code,
} from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

// Define interfaces
interface ProjectDetails {
  id: string;
  projectName: string;
  githubUrl: string;
  star: number;
  forks: number;
  totalCommits: number;
  totalBranches: number;
  totalContributors: number;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

interface Commit {
  id: string;
  commitHash: string;
  commitMessage: string;
  AiSummary: string | null;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  committerName: string;
  committerEmail: string;
  committerDate: string;
  projectId: string;
  createdAt: string;
  commitAuthorAvatar?: string; // Optional avatar URL
}

export default function UserProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper functions for commit display
  const formatCommitDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
  };

  // Truncate long commit messages
  const truncateMessage = (message: string, length = 80) => {
    if (message.length <= length) return message;
    return message.substring(0, length) + "...";
  };

  // Get first line of commit message for the title
  const getCommitTitle = (message: string) => {
    const firstLine = message.split("\n")[0];
    return truncateMessage(firstLine, 100);
  };

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    const fetchProjectDetails = async () => {
      try {
        setIsLoading(true);

        // Fetch project details
        const projectResponse = await axios.get(
          `/api/project/getProjectDetails?projectId=${params.projectId}`
        );
        setProject(projectResponse.data.project);

        // Fetch commits
        const commitsResponse = await axios.get(
          `/api/project/getProjectCommits?projectId=${params.projectId}&limit=10`
        );
        setCommits(commitsResponse.data.commits);
      } catch (error) {
        console.error("Error fetching project data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectDetails();
  }, [params.projectId, isSignedIn]);

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 sm:gap-4">
        {/* Back button and Heading */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 gap-2 hover:bg-background/80"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>

          {isLoading ? (
            <Skeleton className="h-18 w-48 mb-2" />
          ) : (
            <GradientHeading as="h1" className="mb-2">
              {project?.projectName || "Project Details"}
            </GradientHeading>
          )}

          {isLoading ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <a
              href={project?.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors mb-4"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="truncate max-w-[350px]">
                {project?.githubUrl.replace(
                  /^https?:\/\/(www\.)?github\.com\//,
                  ""
                )}
              </span>
            </a>
          )}
        </div>
      </div>

      {/* Project Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-border/40 shadow-sm hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
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

          <Card className="border border-border/40 shadow-sm hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <GitCommit className="h-5 w-5 text-primary" />
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
                    project?.createdAt ? formatDate(project.createdAt) : "N/A"
                  }
                />
                <StatItem
                  icon={<Calendar className="h-4 w-4 text-rose-500" />}
                  label="Last Updated"
                  value={
                    project?.updatedAt ? formatDate(project.updatedAt) : "N/A"
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/40 shadow-sm hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3">
                <p className="text-muted-foreground">
                  GitVision has analyzed {project?.totalCommits || 0} commits in
                  this repository providing AI-powered insights and summaries.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Commits with AI Summary */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-6">Recent Commits</h2>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : commits.length > 0 ? (
          <div className="bg-background/50 rounded-lg p-6  border-none">
            <ul className="space-y-6">
              {commits.map((commit, index) => {
                // Generate placeholder avatar using author initials if no avatar exists
                const placeholderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  commit.authorName
                )}&background=random`;

                return (
                  <li key={commit.id} className="relative flex gap-x-4">
                    <div
                      className={cn(
                        index === commits.length - 1 ? "h-6" : "-bottom-6",
                        "absolute left-0 top-0 flex w-6 justify-center"
                      )}
                    >
                      <div className="w-px translate-x-1 bg-border dark:bg-border/60"></div>
                    </div>
                    <>
                      <div className="relative mt-4 flex h-8 w-8 flex-none items-center justify-center bg-background rounded-full ring-1 ring-border">
                        <Image
                          src={commit.commitAuthorAvatar || placeholderAvatar}
                          alt={`${commit.authorName}'s avatar`}
                          className="size-8 rounded-full"
                          width={32}
                          height={32}
                        />
                      </div>
                      <div className="rounded-md flex-auto bg-card p-4 ring-1 ring-inset ring-border dark:ring-border/60 hover:ring-2 hover:ring-primary/40 transition-all duration-200 hover:shadow-md">
                        <div className="flex justify-between gap-x-4">
                          <Link
                            target="_blank"
                            href={`${project?.githubUrl.replace(
                              /\.git$/,
                              ""
                            )}/commit/${commit.commitHash}`}
                            className="py-0.5 text-xs leading-5 text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">
                              {commit.authorName}
                            </span>{" "}
                            <span className="inline-flex items-center">
                              committed {formatCommitDate(commit.authorDate)}
                              <ExternalLink className="ml-1 size-3" />
                            </span>
                          </Link>
                        </div>
                        <div className="mt-2 font-semibold text-foreground">
                          {getCommitTitle(commit.commitMessage)}
                        </div>

                        {commit.AiSummary && (
                          <div className="mt-3 flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                            <div>
                              <span className="text-xs font-medium text-primary mb-1 block">
                                AI Summary
                              </span>
                              <pre className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground font-sans">
                                {commit.AiSummary}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <Card className="border border-border/40 p-8 text-center">
            <p className="text-muted-foreground">
              No commits found for this project.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

// Helper components
const StatItem = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) => (
  <div className="flex items-center gap-2">
    {icon}
    <span className="text-muted-foreground">{label}:</span>
    <span className="text-foreground font-medium">{value}</span>
  </div>
);

// Helper function to format dates
const formatDate = (dateString: string) => {
  return format(new Date(dateString), "MMM d, yyyy");
};
