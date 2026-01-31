/**
 * =============================================================================
 * ADD REPOSITORY UTILITY FUNCTIONS
 * =============================================================================
 *
 * Helper functions for repository form handling.
 *
 * @module create-new-project/utils
 */

import { RepoInfo } from "./add-repo.constants";

/**
 * Extract owner and repository name from GitHub URL
 *
 * @param url - GitHub repository URL
 * @returns Object with owner and repo name, or null if invalid
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
 * Get loading message based on current step
 *
 * @param step - Current form step (1-3)
 * @returns Loading message for the step
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

/**
 * Simulate validation delay for better UX
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
