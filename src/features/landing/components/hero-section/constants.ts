import { GitBranchIcon, ActivityIcon, ZapIcon } from "lucide-react";

/**
 * The hero's three counters, each a real `COUNT(*)` from `getPublicStats`.
 *
 * `key` is a field of that procedure's return type, not a free string, so
 * renaming a field there breaks this map at compile time instead of rendering
 * `undefined`. That is the only thing standing between a refactor and a hero
 * that quietly says "NaN".
 *
 * The old third stat, "10K+ Developers", had no source at all — there is no
 * developer count anywhere in the schema. `messagesCount` is what exists, so
 * that is the label the number earns.
 */
export const STATS_DATA = [
  { key: "projectsCount", label: "Repos Analyzed" },
  { key: "commitsCount", label: "Commits Processed" },
  { key: "messagesCount", label: "AI Answers" },
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
