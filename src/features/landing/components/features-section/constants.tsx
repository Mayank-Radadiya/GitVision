import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  GitBranchIcon,
  MessageSquareIcon,
  BarChart3Icon,
  UsersIcon,
  SearchIcon,
} from "lucide-react";
import { CommitVisual } from "./commit-visual";

export interface Feature {
  name: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  accentBg: string;
  borderHover: string;
  size: "large" | "standard";
  visual?: ReactNode;
}

export const FEATURES: Feature[] = [
  {
    name: "Commit Intelligence",
    description:
      "AI analyzes commit patterns, code changes, and development history to surface meaningful insights you'd otherwise miss.",
    icon: GitBranchIcon,
    accent: "text-blue-500",
    accentBg: "bg-blue-500/10",
    borderHover: "group-hover:border-blue-500/30",
    size: "large",
    visual: <CommitVisual />,
  },
  {
    name: "ChatGit Interface",
    description:
      "Ask questions about any repository and get instant, AI-powered answers about code changes and patterns.",
    icon: MessageSquareIcon,
    accent: "text-purple-500",
    accentBg: "bg-purple-500/10",
    borderHover: "group-hover:border-purple-500/30",
    size: "standard",
  },
  {
    name: "Visual Analytics",
    description:
      "Beautiful visualizations of contributor activity, code velocity, and development trends over time.",
    icon: BarChart3Icon,
    accent: "text-amber-500",
    accentBg: "bg-amber-500/10",
    borderHover: "group-hover:border-amber-500/30",
    size: "standard",
  },
  {
    name: "Team Insights",
    description:
      "Understand who's contributing what, identify key developers, and track team productivity.",
    icon: UsersIcon,
    accent: "text-green-500",
    accentBg: "bg-green-500/10",
    borderHover: "group-hover:border-green-500/30",
    size: "standard",
  },
  {
    name: "Smart Code Search",
    description:
      "Find and understand specific code changes across repository history with AI assistance.",
    icon: SearchIcon,
    accent: "text-rose-500",
    accentBg: "bg-rose-500/10",
    borderHover: "group-hover:border-rose-500/30",
    size: "standard",
  },
];
