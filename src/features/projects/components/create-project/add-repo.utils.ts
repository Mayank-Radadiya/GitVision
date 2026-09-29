/**
 * Create Project — Utility Functions
 *
 * Helpers for repository URL parsing and the living graph's cosmetic labels.
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
