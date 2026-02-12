import Link from "next/link";
import { GithubIcon, StarIcon } from "lucide-react";
import { GITHUB_REPO_URL } from "./constants";

export function GitHubStarBadge() {
  return (
    <Link
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/50 px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-border hover:text-foreground cursor-pointer"
    >
      <GithubIcon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Star</span>
      <span className="inline-flex items-center text-amber-500/80 dark:text-amber-400/80 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
        <StarIcon className="h-3 w-3 fill-current" />
      </span>
    </Link>
  );
}
