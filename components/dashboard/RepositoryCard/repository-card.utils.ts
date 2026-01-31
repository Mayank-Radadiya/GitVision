/**
 * =============================================================================
 * REPOSITORY CARD UTILITY FUNCTIONS
 * =============================================================================
 *
 * Helper functions for the repository card component.
 *
 * @module RepositoryCard/utils
 */

/**
 * Format large numbers into compact notation (e.g., 1.2k, 3.4M)
 *
 * @param num - Number to format
 * @returns Formatted string
 *
 * @example
 * formatNumber(1234) // "1.2k"
 * formatNumber(1234567) // "1.2M"
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

/**
 * Extract repository path from GitHub URL
 *
 * @param url - Full GitHub URL
 * @returns Repository path (e.g., "user/repo")
 */
export function extractRepoPath(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?github\.com\//, "");
}
