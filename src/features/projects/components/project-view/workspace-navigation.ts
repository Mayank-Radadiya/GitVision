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
    id: "commits",
    label: "Commits",
    icon: GitCommitHorizontal,
    description: "Your repository’s activity, with AI analysis on demand.",
  },
  {
    id: "pull-requests",
    label: "Pull Requests",
    icon: GitPullRequest,
    description: "Follow changes moving toward your main branch.",
  },
  {
    id: "issues",
    label: "Issues",
    icon: CircleDot,
    description: "Track work and follow the discussion.",
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

export type ProjectWindow = 7 | 30 | 90;
export interface WorkspaceLocation {
  section: ProjectTab;
  days: ProjectWindow;
}

export function readWorkspaceLocation(params: {
  get: (key: string) => string | null;
}): WorkspaceLocation {
  const section = params.get("section");
  const days = Number(params.get("days"));
  return {
    section:
      PROJECT_SECTIONS.find((item) => item.id === section)?.id ?? "overview",
    days: days === 7 || days === 30 || days === 90 ? days : 30,
  };
}

export function workspaceUrl(
  pathname: string,
  params: URLSearchParams,
  next: Partial<WorkspaceLocation>,
): string {
  const search = new URLSearchParams(params);
  if (next.section !== undefined) {
    if (next.section === "overview") search.delete("section");
    else search.set("section", next.section);
  }
  if (next.days !== undefined) {
    if (next.days === 30) search.delete("days");
    else search.set("days", String(next.days));
  }
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}
