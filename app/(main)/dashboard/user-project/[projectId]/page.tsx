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
import { useMutation } from "@tanstack/react-query";
import { getAiSummaryOfCommit } from "@/lib/github";

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
  authorAvatar?: string; // Optional avatar URL
  authorDate: string;
  committerName: string;
  committerEmail: string;
  committerDate: string;
  projectId: string;
  createdAt: string;
}

export default function UserProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingCommitId, setGeneratingCommitId] = useState<string | null>(
    null
  );

  const { mutate: AiSummary } = useMutation({
    mutationFn: ({
      githubUrl,
      commitHash,
      projectId,
      commitId,
    }: {
      githubUrl: string;
      commitHash: string;
      projectId: string;
      commitId?: string;
    }) => getAiSummaryOfCommit(githubUrl, commitHash, projectId, commitId),
    onMutate: (variables) => {
      // Set the generating state when mutation starts
      setGeneratingCommitId(variables.commitId || null);
      return { previousCommits: [...commits] };
    },
    onSuccess: (data, variables) => {
      // Update the commits state with the new AI summary
      setCommits((current) =>
        current.map((commit) =>
          commit.id === variables.commitId
            ? { ...commit, AiSummary: data }
            : commit
        )
      );
      // Reset generating state
      setGeneratingCommitId(null);
    },
    // eslint-disable-next-line
    onError: (err, context: any) => {
      // Reset generating state on error
      setGeneratingCommitId(null);
      console.error("Error generating AI summary:", err);

      // Optionally revert to the previous state
      if (context?.previousCommits) {
        setCommits(context.previousCommits);
      }
    },
  });

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
    <div className="space-y-8 p-8 bg-gradient-to-b from-background to-background/70">
      {/* Header */}
      <div className="flex flex-col gap-4 max-w-screen-2xl mx-auto">
        {/* Navigation and back button */}
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

        {/* Project header with repo details */}
        <div className="bg-gradient-to-r from-background via-muted/20 to-background rounded-lg p-6 border border-border/30 shadow-sm mb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 sm:gap-4">
            <div className="space-y-2">
              {isLoading ? (
                <Skeleton className="h-10 w-48 mb-2" />
              ) : (
                <GradientHeading as="h1" className="mb-2">
                  {project?.projectName || "Project Details"}
                </GradientHeading>
              )}

              {isLoading ? (
                <Skeleton className="h-6 w-64" />
              ) : (
                <Link
                  href={project ? project.githubUrl : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground flex items-center gap-2 hover:text-primary transition-colors group"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 group-hover:bg-muted transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </div>
                  <span className="truncate max-w-[350px]">
                    {project?.githubUrl.replace(
                      /^https?:\/\/(www\.)?github\.com\//,
                      ""
                    )}
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
                  href={project?.githubUrl || "#"}
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

      {/* Project Stats */}
      <div className="max-w-screen-2xl mx-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <Card className="border border-border/40 shadow-sm hover:shadow-md transition-all duration-200 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-md">
                    <GitCommit className="h-5 w-5 text-primary" />
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
                    GitVision has analyzed {project?.totalCommits || 0} commits
                    in this repository providing AI-powered insights and
                    summaries.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Recent Commits with AI Summary */}
      <div className="mt-8 max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Recent Commits</h2>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>AI-powered commit summaries</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : commits.length > 0 ? (
          <div className="bg-background/50 rounded-lg p-6 shadow-sm border border-border/30">
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
                          src={commit.authorAvatar || placeholderAvatar}
                          alt={`${commit.authorName}'s avatar`}
                          className="size-8 rounded-full"
                          width={32}
                          height={32}
                        />
                      </div>
                      <div className="rounded-md flex-auto bg-card p-4 ring-1 ring-inset ring-border dark:ring-border/60 hover:ring-2 hover:ring-primary/40 transition-all duration-200 hover:shadow-md backdrop-blur-sm">
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

                          {!commit.AiSummary &&
                            generatingCommitId !== commit.id && (
                              <Button
                                className="text-xs flex items-center gap-1.5 shadow-sm"
                                variant="outline"
                                disabled={generatingCommitId !== null}
                                onClick={() =>
                                  AiSummary({
                                    githubUrl: project?.githubUrl || "",
                                    commitHash: commit.commitHash,
                                    projectId: project?.id || "",
                                    commitId: commit.id,
                                  })
                                }
                              >
                                <Sparkles className="h-3 w-3" />
                                Generate AI Summary
                              </Button>
                            )}
                        </div>
                        <div className="mt-2 font-semibold text-foreground">
                          {getCommitTitle(commit.commitMessage)}
                        </div>

                        {/* AI Summary Section */}
                        {generatingCommitId === commit.id ? (
                          <div className="mt-3 bg-muted/30 rounded-md p-3 border border-border/30">
                            <div className="flex items-center gap-2">
                              <div className="animate-spin h-4 w-4 border-2 border-primary rounded-full border-t-transparent"></div>
                              <span className="text-sm font-medium text-primary">
                                Generating AI summary...
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              This may take a few moments as we analyze the
                              commit changes
                            </div>
                          </div>
                        ) : commit.AiSummary ? (
                          <div className="mt-3 bg-primary/5 rounded-md p-3 border border-primary/20 hover:border-primary/30 transition-colors">
                            <div className="flex items-start gap-2">
                              <Sparkles className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                              <div className="w-full">
                                <div className="text-xs font-medium text-primary mb-1.5 flex items-center gap-1.5">
                                  <span>AI SUMMARY</span>
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70"></span>
                                </div>
                                <div className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground font-sans">
                                  {commit.AiSummary}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 bg-muted/20 rounded-md p-3 border border-muted">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  No AI summary available
                                </span>
                              </div>
                              <Button
                                className="text-xs h-7 px-2"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  AiSummary({
                                    githubUrl: project?.githubUrl || "",
                                    commitHash: commit.commitHash,
                                    projectId: project?.id || "",
                                    commitId: commit.id,
                                  })
                                }
                                disabled={generatingCommitId !== null}
                              >
                                Generate
                              </Button>
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
          <Card className="border border-border/40 p-8 text-center bg-card/50 backdrop-blur-sm">
            <div className="flex flex-col items-center justify-center gap-4">
              <GitCommit className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                No commits found for this project.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => router.push("/dashboard")}
              >
                Return to Dashboard
              </Button>
            </div>
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
  <div className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/60">
      {icon}
    </div>
    <span className="text-muted-foreground">{label}:</span>
    <span className="text-foreground font-medium">{value}</span>
  </div>
);

// Helper function to format dates
const formatDate = (dateString: string) => {
  return format(new Date(dateString), "MMM d, yyyy");
};
