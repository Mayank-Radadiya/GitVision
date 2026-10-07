import {
  LayoutGrid,
  GitCommitHorizontal,
  GitPullRequest,
  CircleDot,
  Files,
  Users,
  Settings2,
} from "lucide-react";
import type { ProjectTab } from "@/features/projects/types/project.types";

export const PROJECT_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutGrid,
    description: "The context behind your code.",
  },
  {
    id: "issues",
    label: "Issues",
    icon: CircleDot,
    description: "Track work and follow the discussion.",
  },
  {
    id: "pull-requests",
    label: "Pull Requests",
    icon: GitPullRequest,
    description: "Follow changes moving toward your main branch.",
  },
  {
    id: "files",
    label: "Files",
    icon: Files,
    description: "Explore the source, without leaving your workspace.",
  },
  {
    id: "team",
    label: "Contributors",
    icon: Users,
    description: "The people behind recent changes.",
  },
  {
    id: "commits",
    label: "Commits",
    icon: GitCommitHorizontal,
    description: "Your repository’s activity, with AI analysis on demand.",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings2,
    description: "Manage your project and repository connection.",
  },
] as const satisfies ReadonlyArray<{
  id: ProjectTab;
  label: string;
  icon: React.ElementType;
  description: string;
}>;

export const PROJECT_COMMAND_EVENT = "gitvision:project-command";
export const OPEN_COMMAND_EVENT = "gitvision:open-command";
export type ProjectCommand = ProjectTab | "details";
