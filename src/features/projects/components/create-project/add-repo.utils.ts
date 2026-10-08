/**
 * Create Project — Utility Functions
 *
 * Helpers for repository URL parsing and project name derivation.
 */

import { RepoInfo } from "./add-repo.constants";

/**
 * Extract owner and repository name from a GitHub URL.
 *
 * @example
 * extractRepoInfo("https://github.com/user/repo")
 * // { owner: "user", repo: "repo" }
 */
export function extractRepoInfo(url: string): RepoInfo | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ""),
    };
  }
  return null;
}

/**
 * Derive a clean, human-readable project name from a repository slug.
 *
 * @example
 * deriveProjectName("next-enterprise") // "Next Enterprise"
 * deriveProjectName("react") // "React"
 * deriveProjectName("tailwindcss") // "Tailwindcss"
 */
export function deriveProjectName(repo: string): string {
  if (!repo) return "";
  const cleaned = repo.replace(/\.git$/, "");
  // If it's already camelCased or MixedCase, preserve it
  if (/[a-z][A-Z]/.test(cleaned)) {
    return cleaned;
  }
  // Otherwise split on '-' or '_' and capitalize words
  return cleaned
    .split(/[-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
