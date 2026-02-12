import { GitBranchIcon, ActivityIcon, ZapIcon } from "lucide-react";

export const STATS_DATA = [
  { value: "50K+", label: "Repos Analyzed" },
  { value: "1M+", label: "Commits Processed" },
  { value: "10K+", label: "Developers" },
] as const;

export const FLOATING_BADGES = [
  {
    icon: GitBranchIcon,
    text: "Branch Insights",
    className: "-left-16 top-24",
    delay: 1.3,
  },
  {
    icon: ActivityIcon,
    text: "Commit Analysis",
    className: "-right-16 top-16",
    delay: 1.5,
  },
  {
    icon: ZapIcon,
    text: "AI-Powered",
    className: "-left-10 bottom-32",
    delay: 1.7,
  },
] as const;

export const SHOW_EXTRAS_DELAY = 1200;
