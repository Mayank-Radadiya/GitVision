/**
 * Create Project — Utility Functions
 *
 * Helpers for repository URL parsing and form state.
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
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ""),
    };
  }
  return null;
}

/**
 * Get loading message based on current mutation step.
 */
export function getLoadingMessage(step: number): string {
  switch (step) {
    case 2:
      return "Validating...";
    case 3:
      return "Analyzing...";
    default:
      return "Processing...";
  }
}
