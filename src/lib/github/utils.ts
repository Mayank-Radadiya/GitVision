// ============================================================================
// GitHub Module — Pure Utility Functions
// ============================================================================
// All functions here are pure: they take inputs and return outputs
// with no side effects (no DB, no API calls). 100% unit-testable.

import type { CommitData, GitHubFile, GitHubRepoInfo } from "./types";
import {
  DEFAULTS,
  IGNORED_FILE_PATTERNS,
  AI_DIFF_IGNORE_PATTERNS,
  GITHUB_CONFIG,
} from "./constants";
import { GitHubValidationError } from "./errors";

/** Strip a trailing `.git` from a repository URL */
export function removeGitSuffix(url: string): string {
  return url.endsWith(".git") ? url.slice(0, -4) : url;
}

/**
 * Parse a GitHub URL into its owner/repo pair.
 *
 * HTTPS only, and only the two forms `validators.githubUrl` accepts:
 * `https://github.com/owner/repo` and the same with a `.git` suffix. It takes
 * the last two `/`-separated segments and trusts whatever it is given — the
 * host and the number of segments are NOT checked, so an SSH remote
 * (`git@github.com:owner/repo.git`), an Enterprise host, or a deep link all
 * parse into a plausible-looking wrong answer rather than an error. D-9 chose
 * the docstring fix over parsing them; `validators.githubUrl` is what rejects
 * them, and it runs before this on the create-project path.
 *
 * @throws {GitHubValidationError} if the URL is not a string, or has no
 *   non-empty segment in the owner or repo position
 */
export function parseGitHubUrl(githubUrl: string): GitHubRepoInfo {
  if (!githubUrl || typeof githubUrl !== "string") {
    throw new GitHubValidationError(
      "GitHub URL is required and must be a string",
      { provided: githubUrl },
    );
  }

  const cleanUrl = removeGitSuffix(githubUrl.trim());
  const parts = cleanUrl.split("/");
  const owner = parts[parts.length - 2];
  const repo = parts[parts.length - 1];

  if (!owner || !repo || owner.trim() === "" || repo.trim() === "") {
    throw new GitHubValidationError(
      "Invalid GitHub URL format. Expected: https://github.com/owner/repo",
      { url: githubUrl },
    );
  }

  return { owner: owner.trim(), repo: repo.trim() };
}

/**
 * Transform raw GitHub REST API commit data into our database shape.
 * Falls back to DEFAULTS for missing author metadata.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCommitData(commit: any, projectId: string): CommitData {
  return {
    commitHash: commit.sha,
    commitMessage: commit.commit.message || "",
    authorName: (commit.commit.author?.name || DEFAULTS.NAME).substring(0, 255),
    authorAvatar: (commit.author?.avatar_url || DEFAULTS.AVATAR).substring(
      0,
      255,
    ),
    authorEmail: (commit.commit.author?.email || DEFAULTS.EMAIL).substring(
      0,
      255,
    ),
    authorDate: commit.commit.author?.date
      ? new Date(commit.commit.author.date)
      : new Date(),
    committerName: (commit.commit.committer?.name || DEFAULTS.NAME).substring(
      0,
      255,
    ),
    committerEmail: (
      commit.commit.committer?.email || DEFAULTS.EMAIL
    ).substring(0, 255),
    committerDate: commit.commit.committer?.date
      ? new Date(commit.commit.committer.date)
      : new Date(),
    projectId,
  };
}

/** Check whether a file path should be skipped during ingestion */
export function isIgnoredPath(filePath: string): boolean {
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/** Check whether a file should be excluded from AI diff context */
export function isAiDiffIgnored(filename: string): boolean {
  return AI_DIFF_IGNORE_PATTERNS.some((pattern) => pattern.test(filename));
}

/**
 * Builds an AI-friendly diff string from GitHub file patches.
 *
 * 1. Filters out lock files, SVGs, and minified bundles
 * 2. Sorts remaining files smallest-first (fit as many as possible)
 * 3. Concatenates up to DIFF_MAX_LENGTH characters, then stops
 */
export function buildSmartDiff(files: GitHubFile[]): string {
  const importantFiles = files.filter((f) => !isAiDiffIgnored(f.filename));

  importantFiles.sort(
    (a, b) => (a.patch?.length || 0) - (b.patch?.length || 0),
  );

  let smartDiff = "";
  for (const file of importantFiles) {
    const patch = file.patch || "";
    const entry = `\nFile: ${file.filename}\n${patch}\n`;

    if (smartDiff.length + entry.length > GITHUB_CONFIG.DIFF_MAX_LENGTH) {
      smartDiff += "\n...[omitted remaining files due to size]";
      break;
    }
    smartDiff += entry;
  }

  return smartDiff;
}
