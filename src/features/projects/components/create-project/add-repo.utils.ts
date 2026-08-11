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

/**
 * Deterministic cosmetic short hash for a branch label (brief §4).
 * Client-side flavor only — "#3fa9c2"-style, derived from the typed name.
 */
export function shortHash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `#${(h >>> 0).toString(16).padStart(8, "0").slice(0, 6)}`;
}

/** Truncate a live branch label past `max` chars with an ellipsis (brief §4). */
export function truncateLabel(text: string, max = 24): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}
