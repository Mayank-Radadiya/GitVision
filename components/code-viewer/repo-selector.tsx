"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

interface Project {
  id: string;
  projectName: string;
  githubUrl: string;
}

export function RepoSelector() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Get the current user ID from local storage or other auth methods
        const userId = localStorage.getItem("userId") || "";

        const response = await fetch(
          `/api/project/getUserProject?userId=${userId}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch projects");
        }

        setProjects(data.userProjects || []);
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleSelectProject = (projectId: string) => {
    setValue(projectId);
    setOpen(false);
    router.push(`/code-viwer?projectId=${projectId}`);
  };

  const selectedProject = projects.find((project) => project.id === value);

  if (isLoading) {
    return <Skeleton className="h-10 w-full max-w-xs" />;
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        Error loading repositories: {error}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-xs justify-between"
        >
          {selectedProject
            ? selectedProject.projectName
            : "Select repository..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full max-w-xs p-0">
        <Command>
          <CommandInput placeholder="Search repository..." />
          <CommandEmpty>No repository found.</CommandEmpty>
          <CommandGroup>
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                value={project.id}
                onSelect={() => handleSelectProject(project.id)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === project.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span>{project.projectName}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {project.githubUrl}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
