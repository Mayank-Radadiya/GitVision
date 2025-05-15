"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { redirect, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Code, ExternalLink, Github, Search } from "lucide-react";

import CustomSandpack from "@/components/CustomSandpack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  projectName: string;
  githubUrl: string;
  star: number;
  forks: number;
  createdAt: string;
}

const Page = () => {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("projectId");

  const [projectId, setProjectId] = useState<string>(queryProjectId || "");
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    queryProjectId
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [projectDetails, setProjectDetails] = useState<Project>();
  const [activeTab, setActiveTab] = useState("recent");

  // Redirect if user is not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      redirect("/sign-in?redirect=/github-code");
    }
  }, [user, isLoaded]);

  // Fetch project details when a project is selected
  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!selectedProjectId) return;

      try {
        const response = await fetch(
          `/api/project/getProjectDetails?projectId=${selectedProjectId}`
        );
        const data = await response.json();

        if (response.ok) {
          setProjectDetails(data.project);
        }
      } catch (error) {
        console.error("Error fetching project details:", error);
      }
    };

    fetchProjectDetails();
  }, [selectedProjectId]);

  // Fetch user projects
  useEffect(() => {
    const fetchUserProjects = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const userId = user.id;
        const response = await fetch(
          `/api/project/getUserProject?userId=${userId}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch user projects");
        }

        setUserProjects(data.userProjects || []);
      } catch (err) {
        console.error("Error fetching user projects:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchUserProjects();
    }
  }, [user]);

  const handleViewProject = () => {
    if (projectId.trim()) {
      setSelectedProjectId(projectId);

      // Update URL with projectId for shareable links
      const url = new URL(window.location.href);
      url.searchParams.set("projectId", projectId);
      window.history.pushState({}, "", url);
    }
  };

  // const handleSelectProject = (id: string) => {
  //   setProjectId(id);
  //   setSelectedProjectId(id);

  //   // Update URL with projectId for shareable links
  //   const url = new URL(window.location.href);
  //   url.searchParams.set("projectId", id);
  //   window.history.pushState({}, "", url);
  // };

  // Filter projects based on search query
  const filteredProjects = userProjects.filter(
    (project) =>
      project.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.githubUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort projects by recently added
  const recentProjects = [...filteredProjects].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Sort projects by most stars
  const popularProjects = [...filteredProjects].sort((a, b) => b.star - a.star);

  const displayProjects =
    activeTab === "recent" ? recentProjects : popularProjects;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8 max-w-7xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Code Explorer</h1>
        <p className="text-muted-foreground">
          View and analyze your GitHub repository code with syntax highlighting
        </p>
      </div>

      {!isLoaded ? (
        <div className="grid gap-6">
          <Card>
            <CardContent className="p-6 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 border-2 border-primary/30 border-t-primary animate-spin rounded-full"></div>
                <p className="text-sm text-muted-foreground">
                  Loading your account...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-12">
          <Card className="md:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Your Projects
                <Badge variant="outline" className="ml-2">
                  {filteredProjects.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Select a repository to view its code
              </CardDescription>
              <div className="relative mt-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search repositories..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Tabs
                defaultValue="recent"
                value={activeTab}
                onValueChange={setActiveTab}
              >
                <div className="px-6">
                  <TabsList className="w-full">
                    <TabsTrigger value="recent" className="flex-1">
                      Recent
                    </TabsTrigger>
                    <TabsTrigger value="popular" className="flex-1">
                      Popular
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="recent" className="m-0 mt-2">
                  {renderProjectsList(displayProjects)}
                </TabsContent>

                <TabsContent value="popular" className="m-0 mt-2">
                  {renderProjectsList(displayProjects)}
                </TabsContent>
              </Tabs>
            </CardContent>

            <CardFooter className="flex-col gap-3 p-6">
              <div className="flex items-center w-full gap-3">
                <Input
                  id="projectId"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="Enter project ID"
                  className="flex-1"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleViewProject}
                        disabled={!projectId.trim()}
                      >
                        View <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open the repository with this ID</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  (window.location.href = "/dashboard/add-repository")
                }
              >
                Add New Repository
              </Button>
            </CardFooter>
          </Card>

          <div className="md:col-span-8 space-y-6">
            {selectedProjectId ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {projectDetails && (
                  <Card className="overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <Github className="h-5 w-5" />
                          {projectDetails.projectName}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          <a
                            href={projectDetails.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center hover:underline"
                          >
                            {projectDetails.githubUrl}
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </a>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          variant="secondary"
                          className="flex items-center"
                        >
                          ⭐ {projectDetails.star}
                        </Badge>
                        <Badge variant="outline" className="flex items-center">
                          🍴 {projectDetails.forks}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                )}

                <Card className="overflow-hidden border-none shadow-lg">
                  <CardContent className="p-0">
                    <CustomSandpack projectId={selectedProjectId} />
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <Card className="h-full flex items-center justify-center p-12">
                <div className="text-center space-y-4">
                  <div className="bg-muted p-4 rounded-full inline-flex items-center justify-center">
                    <Code className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold">Select a repository</h3>
                  <p className="text-muted-foreground max-w-md">
                    Choose a repository from the list to view its files with
                    syntax highlighting and code structure.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Helper function to render the projects list
  function renderProjectsList(projects: Project[]) {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-2 p-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (projects.length === 0) {
      return (
        <div className="py-12 text-center text-muted-foreground px-6">
          {searchQuery ? (
            <p>No matching repositories found</p>
          ) : (
            <p>
              No repositories yet. Add your first GitHub repository to get
              started.
            </p>
          )}
        </div>
      );
    }
  }
};

export default Page;
