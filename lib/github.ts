"use server";

import { Octokit } from "octokit";
import { db } from "@/drizzle";
import { commitsTable, projectTables } from "@/drizzle/schema/schema";
import axios, { AxiosRequestConfig } from "axios";
import { eq, and } from "drizzle-orm";
import { aISummariesCommit } from "./gemini";
import { computeHash } from "@/src/features/rag/services/code-chunker";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * GitHub repository information extracted from URL
 */
interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

/**
 * Commit data structure for database insertion
 */
interface CommitData {
  commitHash: string;
  commitMessage: string;
  authorName: string;
  authorAvatar: string;
  authorEmail: string;
  authorDate: Date;
  committerName: string;
  committerEmail: string;
  committerDate: Date;
  projectId: string;
}

/**
 * File information returned from repository file processing
 */
interface FileInfo {
  id: string;
  path: string;
  size: number | undefined;
  sha: string;
}

/**
 * Result of project creation
 */
interface CreateProjectResult {
  projectId: string;
}

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Base error class for all GitHub-related errors
 */
class GitHubError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GitHubError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when input validation fails
 */
class GitHubValidationError extends GitHubError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "GITHUB_VALIDATION_ERROR", 400, details);
    this.name = "GitHubValidationError";
  }
}

/**
 * Error thrown when GitHub API returns an error
 */
class GitHubAPIError extends GitHubError {
  constructor(
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message, "GITHUB_API_ERROR", statusCode, details);
    this.name = "GitHubAPIError";
  }
}

/**
 * Error thrown when GitHub API rate limit is exceeded
 */
class GitHubRateLimitError extends GitHubError {
  constructor(message: string = "GitHub API rate limit exceeded") {
    super(message, "GITHUB_RATE_LIMIT", 429);
    this.name = "GitHubRateLimitError";
  }
}

/**
 * Error thrown when a resource is not found
 */
class GitHubNotFoundError extends GitHubError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found`, "GITHUB_NOT_FOUND", 404, {
      resource,
      identifier,
    });
    this.name = "GitHubNotFoundError";
  }
}

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * GitHub API and processing configuration
 */
const GITHUB_CONFIG = {
  /** Items to fetch per page from GitHub API */
  DEFAULT_PER_PAGE: 100,
  /** Maximum number of retry attempts for failed requests */
  MAX_RETRIES: 3,
  /** Base delay in milliseconds for retry backoff */
  BASE_RETRY_DELAY: 2000,
  /** Maximum delay in milliseconds for retry backoff */
  MAX_RETRY_DELAY: 10000,
  /** Number of commits to batch for database insertion */
  COMMIT_BATCH_SIZE: 10,
  /** Number of files to process in parallel */
  FILE_BATCH_SIZE: 10,
  /** Maximum length of diff data to process */
  DIFF_MAX_LENGTH: 10000,
  /** Request timeout in milliseconds */
  REQUEST_TIMEOUT: 30000,
} as const;

/**
 * HTTP status codes that should trigger a retry
 */
const RETRYABLE_STATUS_CODES = [404, 429, 500, 502, 503, 504] as const;

/**
 * Default values for missing GitHub data
 */
const DEFAULTS = {
  AVATAR: "https://via.placeholder.com/150",
  EMAIL: "unknown@example.com",
  NAME: "Unknown",
} as const;

/**
 * File patterns to ignore when fetching repository files
 */
const IGNORED_FILE_PATTERNS = [
  // Build and dependency directories
  /^node_modules\//,
  /^dist\//,
  /^build\//,
  /^\\.next\//,
  /^\\.nuxt\//,
  /^out\//,
  /^vendor\//,

  // Cache and temp directories
  /^coverage\//,
  /^\\.cache\//,
  /^\\.turbo\//,
  /^__pycache__\//,
  /^env\//,

  // IDE directories
  /^\\.vscode\//,
  /^\\.idea\//,
  /^\\.angular\//,
  /^\\.jest\//,

  // Log files and directories
  /^logs?\//,
  /^storage\/logs\//,
  /\\.log$/i,

  // Test snapshots
  /^__snapshots__\//,

  // Environment and config
  /\\.env(\\..*)?$/i,
  /\\.DS_Store$/,
  /\\.eslintcache$/,
  /\\.prettiercache$/,

  // Binary and media files
  /\\.(png|jpe?g|gif|svg|webp|bmp|ico|avif|tiff?|heic|heif)$/i,
  /\\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v|3gp|mpg|mpeg)$/i,
  /\\.(mp3|wav|ogg|m4a|flac|aac|wma)$/i,
  /\\.(zip|tar|gz|rar|7z|bz2|xz|dmg|iso)$/i,
  /\\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i,
  /\\.(woff2?|ttf|eot|otf)$/i,
  /\\.pyc$/,
] as const;

// ============================================================================
// OCTOKIT INSTANCE
// ============================================================================

if (!process.env.GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN environment variable is required");
}

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Removes the .git suffix from a GitHub URL if present
 * @param url - GitHub URL to clean
 * @returns URL without .git suffix
 */
function removeGitSuffix(url: string): string {
  return url.endsWith(".git") ? url.slice(0, -4) : url;
}

/**
 * Validates and parses a GitHub URL to extract owner and repository name
 * @param githubUrl - GitHub repository URL
 * @returns Object containing owner and repo
 * @throws {GitHubValidationError} If URL is invalid or missing required parts
 */
function parseGitHubUrl(githubUrl: string): GitHubRepoInfo {
  if (!githubUrl || typeof githubUrl !== "string") {
    throw new GitHubValidationError(
      "GitHub URL is required and must be a string",
      {
        provided: githubUrl,
      },
    );
  }

  const cleanUrl = removeGitSuffix(githubUrl.trim());
  const parts = cleanUrl.split("/");
  const owner = parts[parts.length - 2];
  const repo = parts[parts.length - 1];

  if (!owner || !repo || owner.trim() === "" || repo.trim() === "") {
    throw new GitHubValidationError(
      "Invalid GitHub URL format. Expected format: https://github.com/owner/repo",
      { url: githubUrl },
    );
  }

  return { owner: owner.trim(), repo: repo.trim() };
}

/**
 * Fetches data from a URL with automatic retry logic and exponential backoff
 * @param url - URL to fetch
 * @param options - Axios request configuration
 * @param retries - Maximum number of retry attempts
 * @param delay - Base delay in milliseconds between retries
 * @returns Axios response
 * @throws {GitHubAPIError} If all retry attempts fail
 */
async function fetchWithRetry(
  url: string,
  options: AxiosRequestConfig = {},
  retries: number = GITHUB_CONFIG.MAX_RETRIES,
  delay: number = GITHUB_CONFIG.BASE_RETRY_DELAY,
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await axios.get(url, {
        ...options,
        timeout: options.timeout || GITHUB_CONFIG.REQUEST_TIMEOUT,
      });
    } catch (error: unknown) {
      lastError = error as Error;
      const axiosError = error as {
        response?: { status?: number };
        message?: string;
      };
      const statusCode = axiosError.response?.status;

      // Check if error is retryable
      const isRetryable =
        statusCode &&
        RETRYABLE_STATUS_CODES.includes(
          statusCode as (typeof RETRYABLE_STATUS_CODES)[number],
        );

      if (isRetryable && attempt < retries - 1) {
        const waitTime = Math.min(
          delay * Math.pow(2, attempt),
          GITHUB_CONFIG.MAX_RETRY_DELAY,
        );

        console.warn(
          `[GitHub] Request failed with status ${statusCode}. Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${retries})`,
          { url, statusCode },
        );

        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      // If not retryable or out of retries, throw
      if (statusCode === 429) {
        throw new GitHubRateLimitError();
      } else if (statusCode === 404) {
        throw new GitHubNotFoundError("Resource", url);
      } else if (statusCode && statusCode >= 400) {
        throw new GitHubAPIError(
          `GitHub API request failed: ${axiosError.message || "Unknown error"}`,
          statusCode,
          { url, attempt: attempt + 1 },
        );
      }

      throw error;
    }
  }

  throw new GitHubAPIError(
    `Max retries (${retries}) reached for URL: ${url}`,
    500,
    { lastError: lastError?.message },
  );
}

/**
 * Creates a CommitData object from GitHub API commit data
 * @param commit - Commit data from GitHub API
 * @param projectId - Project ID to associate with the commit
 * @returns Formatted commit data for database insertion
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createCommitData(commit: any, projectId: string): CommitData {
  return {
    commitHash: commit.sha,
    commitMessage: commit.commit.message || "",
    authorName: commit.commit.author?.name || DEFAULTS.NAME,
    authorAvatar: commit.author?.avatar_url || DEFAULTS.AVATAR,
    authorEmail: commit.commit.author?.email || DEFAULTS.EMAIL,
    authorDate: commit.commit.author?.date
      ? new Date(commit.commit.author.date)
      : new Date(),
    committerName: commit.commit.committer?.name || DEFAULTS.NAME,
    committerEmail: commit.commit.committer?.email || DEFAULTS.EMAIL,
    committerDate: commit.commit.committer?.date
      ? new Date(commit.commit.committer.date)
      : new Date(),
    projectId,
  };
}

/**
 * Logs structured information with consistent formatting
 * @param level - Log level (info, warn, error)
 * @param message - Log message
 * @param meta - Additional metadata
 */
function log(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>,
): void {
  switch (level) {
    case "error":
      console.error(`[GitHub:Error] ${message}`, meta || "");
      break;
    case "warn":
      console.warn(`[GitHub:Warn] ${message}`, meta || "");
      break;
    default:
      console.log(`[GitHub:Info] ${message}`, meta || "");
  }
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Fetches all commit hashes from a GitHub repository and stores them in the database
 *
 * This function retrieves all commits from a GitHub repository using pagination,
 * processes them in batches, and stores them in the database. It handles errors
 * gracefully and provides detailed logging throughout the process.
 *
 * @param githubUrl - Full GitHub repository URL (e.g., https://github.com/owner/repo)
 * @param projectId - UUID of the project to associate commits with
 * @returns Total number of commits stored in the database
 *
 * @throws {GitHubValidationError} If the GitHub URL is invalid
 * @throws {GitHubAPIError} If the GitHub API request fails
 * @throws {Error} If database operations fail
 *
 * @example
 * const commitCount = await getCommitHashes(
 *   "https://github.com/vercel/next.js",
 *   "123e4567-e89b-12d3-a456-426614174000"
 * );
 * console.log(`Stored ${commitCount} commits`);
 */
export const getCommitHashes = async (
  githubUrl: string,
  projectId: string,
): Promise<number> => {
  try {
    // Validate and parse GitHub URL
    const { owner, repo } = parseGitHubUrl(githubUrl);

    log("info", "Fetching commits from GitHub", { owner, repo, projectId });

    // Fetch all commits using pagination
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      per_page: GITHUB_CONFIG.DEFAULT_PER_PAGE,
    });

    log("info", `Fetched ${commits.length} commits from GitHub`, {
      owner,
      repo,
      count: commits.length,
    });

    // Process commits in batches
    const batchSize = GITHUB_CONFIG.COMMIT_BATCH_SIZE;
    let totalStored = 0;

    for (let i = 0; i < commits.length; i += batchSize) {
      const batch = commits.slice(i, i + batchSize);
      const commitDataForDb = batch.map((commit) =>
        createCommitData(commit, projectId),
      );

      try {
        await db.insert(commitsTable).values(commitDataForDb);
        totalStored += commitDataForDb.length;

        log("info", `Stored batch of commits`, {
          batchNumber: Math.floor(i / batchSize) + 1,
          batchSize: commitDataForDb.length,
          totalStored,
        });
      } catch (dbError) {
        log("error", `Failed to store commit batch`, {
          batchNumber: Math.floor(i / batchSize) + 1,
          error: dbError instanceof Error ? dbError.message : "Unknown error",
        });
        throw dbError;
      }
    }

    log("info", "Successfully stored all commits", {
      owner,
      repo,
      totalCommits: totalStored,
    });

    return totalStored;
  } catch (error) {
    if (
      error instanceof GitHubValidationError ||
      error instanceof GitHubAPIError
    ) {
      throw error;
    }

    log("error", "Error fetching or storing commits", {
      githubUrl,
      projectId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    throw new GitHubError(
      "Failed to fetch and store commits",
      "COMMIT_FETCH_ERROR",
      500,
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
};

/**
 * Creates a new project in the database with GitHub repository information
 *
 * Fetches repository metadata from GitHub (stars, forks, branches, contributors, commits)
 * and creates a new project entry in the database with this information.
 *
 * @param url - GitHub repository URL
 * @param projectName - Name for the project
 * @param userId - ID of the user creating the project
 * @returns Object containing the created project's ID
 *
 * @throws {GitHubValidationError} If inputs are invalid
 * @throws {GitHubAPIError} If GitHub API requests fail
 * @throws {Error} If database operation fails
 *
 * @example
 * const result = await createNewProject(
 *   "https://github.com/vercel/next.js",
 *   "Next.js Framework",
 *   "user_123"
 * );
 * console.log(`Created project with ID: ${result.projectId}`);
 */
export async function createNewProject(
  url: string,
  projectName: string,
  userId: string,
): Promise<CreateProjectResult> {
  try {
    // Validate inputs
    if (
      !projectName ||
      typeof projectName !== "string" ||
      projectName.trim() === ""
    ) {
      throw new GitHubValidationError(
        "Project name is required and must be a non-empty string",
      );
    }

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      throw new GitHubValidationError(
        "User ID is required and must be a non-empty string",
      );
    }

    // Parse and validate GitHub URL
    const { owner, repo } = parseGitHubUrl(url);

    log("info", "Creating new project", { owner, repo, projectName, userId });

    // Fetch repository data
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });

    // Fetch branches with pagination
    const branches = await octokit.paginate(octokit.rest.repos.listBranches, {
      owner,
      repo,
      per_page: GITHUB_CONFIG.DEFAULT_PER_PAGE,
    });

    // Fetch contributors with pagination
    const contributors = await octokit.paginate(
      octokit.rest.repos.listContributors,
      {
        owner,
        repo,
        per_page: GITHUB_CONFIG.DEFAULT_PER_PAGE,
      },
    );

    // Fetch commits with pagination
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      per_page: GITHUB_CONFIG.DEFAULT_PER_PAGE,
    });

    // Create project in database
    const [newProject] = await db
      .insert(projectTables)
      .values({
        projectName: projectName.trim() || repoData.name,
        githubUrl: url,
        ownerId: userId,
        star: repoData.stargazers_count || 0,
        forks: repoData.forks_count || 0,
        totalBranches: branches.length,
        totalContributors: contributors.length,
        totalCommits: commits.length,
        embeddingStatus: "pending", // Deferred RAG processing
        embeddingProgress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!newProject || !newProject.id) {
      throw new Error("Failed to create project in database");
    }

    log("info", "Successfully created project", {
      projectId: newProject.id,
      projectName: newProject.projectName,
      stats: {
        stars: newProject.star,
        forks: newProject.forks,
        branches: newProject.totalBranches,
        contributors: newProject.totalContributors,
        commits: newProject.totalCommits,
      },
    });

    return {
      projectId: newProject.id,
    };
  } catch (error) {
    if (
      error instanceof GitHubValidationError ||
      error instanceof GitHubAPIError ||
      error instanceof GitHubRateLimitError
    ) {
      throw error;
    }

    log("error", "Error creating new project", {
      url,
      projectName,
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    throw new GitHubError(
      "Failed to create project",
      "PROJECT_CREATE_ERROR",
      500,
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
}

/**
 * Fetches all files from a GitHub repository and stores them in the database
 *
 * Retrieves the complete file tree from the repository's default branch,
 * filters out ignored files (node_modules, build artifacts, media files, etc.),
 * and stores the file content in the database in batches for efficiency.
 *
 * @param owner - GitHub repository owner
 * @param repo - GitHub repository name
 * @param projectId - UUID of the project to associate files with
 * @returns Array of stored file information
 *
 * @throws {GitHubValidationError} If inputs are invalid
 * @throws {GitHubAPIError} If GitHub API requests fail
 * @throws {Error} If database operations fail
 *
 * @example
 * const files = await getRepositoryFiles("vercel", "next.js", "project-uuid");
 * console.log(`Stored ${files.length} files`);
 */
export async function getRepositoryFiles(
  owner: string,
  repo: string,
  projectId: string,
): Promise<FileInfo[]> {
  try {
    // Validate inputs
    if (!owner || !repo || !projectId) {
      throw new GitHubValidationError(
        "Owner, repo, and projectId are required",
        {
          owner,
          repo,
          projectId,
        },
      );
    }

    log("info", "Fetching repository files", { owner, repo, projectId });

    // Get the default branch
    const {
      data: { default_branch },
    } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    // Get the latest commit to get the tree SHA
    const {
      data: {
        commit: {
          tree: { sha: treeSha },
        },
      },
    } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: default_branch,
    });

    // Get the full tree recursively
    const {
      data: { tree },
    } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: "1",
    });

    // Import database modules dynamically
    const { db } = await import("@/drizzle");
    const { projectFiles } = await import("@/drizzle/schema/schema");

    // Filter files that are NOT in the ignore list
    const filesToProcess = tree.filter(
      (item) =>
        item.type === "blob" &&
        item.path &&
        !IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(item.path!)),
    );

    log("info", `Filtered ${filesToProcess.length} files to process`, {
      totalFiles: tree.length,
      processableFiles: filesToProcess.length,
    });

    const storedFiles: FileInfo[] = [];
    const batchSize = GITHUB_CONFIG.FILE_BATCH_SIZE;

    // Create batches of files
    const fileBatches: (typeof filesToProcess)[] = [];
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      fileBatches.push(filesToProcess.slice(i, i + batchSize));
    }

    // Process each batch
    for (const [batchIndex, batch] of fileBatches.entries()) {
      log(
        "info",
        `Processing file batch ${batchIndex + 1}/${fileBatches.length}`,
        {
          batchSize: batch.length,
        },
      );

      const batchPromises = batch.map(async (file) => {
        try {
          if (!file.sha || !file.path) {
            log("warn", "File missing sha or path, skipping", { file });
            return null;
          }

          // Get file content
          const { data: blob } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: file.sha,
          });

          // Decode content from base64 and check if it's valid UTF-8
          let content: string;
          try {
            const buffer = Buffer.from(blob.content, "base64");
            content = buffer.toString("utf-8");

            // Check if the decoded content contains null bytes (binary file indicator)
            if (content.includes("\0")) {
              log("warn", `Skipping binary file ${file.path}`, {
                path: file.path,
              });
              return null;
            }
          } catch (decodeError) {
            log(
              "warn",
              `Skipping file with invalid UTF-8 encoding: ${file.path}`,
              {
                path: file.path,
                error:
                  decodeError instanceof Error
                    ? decodeError.message
                    : "Unknown error",
              },
            );
            return null;
          }

          // Compute hash for RAG processing
          const hash = computeHash(content);

          // Store in database
          const [newFile] = await db
            .insert(projectFiles)
            .values({
              fileName: file.path,
              code: content,
              projectId: projectId,
              hash: hash,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          return {
            id: newFile.id,
            path: file.path,
            size: file.size,
            sha: file.sha,
          };
        } catch (error) {
          log("error", `Error processing file ${file.path}`, {
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      storedFiles.push(...(batchResults.filter(Boolean) as FileInfo[]));
    }

    log(
      "info",
      `Successfully stored ${storedFiles.length} files in the database`,
      {
        owner,
        repo,
        projectId,
        totalFiles: storedFiles.length,
      },
    );

    // Note: RAG processing is now deferred until user selects project for chat
    // This significantly speeds up project creation

    return storedFiles;
  } catch (error) {
    if (
      error instanceof GitHubValidationError ||
      error instanceof GitHubAPIError
    ) {
      throw error;
    }

    log("error", "Error fetching repository files", {
      owner,
      repo,
      projectId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    throw new GitHubError(
      "Failed to fetch repository files",
      "FILE_FETCH_ERROR",
      500,
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
}

/**
 * Generates an AI summary for a specific commit by fetching its diff and processing it
 *
 * This function retrieves the commit diff from GitHub using multiple fallback methods,
 * truncates if necessary, and sends it to an AI service for summary generation.
 * The generated summary is stored in the database for future reference.
 *
 * @param githubUrl - Full GitHub repository URL
 * @param commitHash - SHA hash of the commit
 * @param projectId - UUID of the project
 * @param commitId - Optional UUID of the commit record in database
 * @returns AI-generated summary of the commit
 *
 * @throws {GitHubValidationError} If inputs are invalid
 * @throws {GitHubNotFoundError} If commit is not found in database
 *
 * @example
 * const summary = await getAiSummaryOfCommit(
 *   "https://github.com/vercel/next.js",
 *   "abc123...",
 *   "project-uuid"
 * );
 * console.log(summary);
 */
export async function getAiSummaryOfCommit(
  githubUrl: string,
  commitHash: string,
  projectId: string,
  commitId?: string,
): Promise<string> {
  try {
    // Validate inputs
    if (!commitHash || typeof commitHash !== "string") {
      throw new GitHubValidationError("Commit hash is required");
    }

    if (!projectId || typeof projectId !== "string") {
      throw new GitHubValidationError("Project ID is required");
    }

    // Check if the commit exists in our database
    const existingCommit = await db
      .select()
      .from(commitsTable)
      .where(
        commitId
          ? eq(commitsTable.id, commitId)
          : and(
              eq(commitsTable.commitHash, commitHash),
              eq(commitsTable.projectId, projectId),
            ),
      )
      .limit(1);

    if (!existingCommit || existingCommit.length === 0) {
      throw new GitHubNotFoundError("Commit", commitId || commitHash);
    }

    const commitRecord = existingCommit[0];
    const commitHashToUse = commitRecord.commitHash || commitHash;

    // Parse GitHub URL
    const { owner, repo } = parseGitHubUrl(githubUrl);

    log("info", `Fetching diff for commit ${commitHashToUse}`, { owner, repo });

    // Extract commit message for fallback
    const commitMessage = commitRecord.commitMessage || "No message available";
    let diffData = "";

    // Method 1: Try raw diff URL with retry
    const fetchMethod1 = async (): Promise<string> => {
      const { data } = await fetchWithRetry(
        `https://github.com/${owner}/${repo}/commit/${commitHashToUse}.diff`,
        {
          headers: {
            Accept: "application/vnd.github.v3.diff",
            "User-Agent": "GitVision App (https://gitvision.vercel.app/)",
          },
        },
        3,
        3000,
      );
      return data;
    };

    // Method 2: Try GitHub API with diff media type
    const fetchMethod2 = async (): Promise<string> => {
      try {
        const response = await octokit.request(
          "GET /repos/{owner}/{repo}/commits/{commit_sha}",
          {
            owner,
            repo,
            commit_sha: commitHashToUse,
            headers: {
              accept: "application/vnd.github.v3.diff",
            },
          },
        );

        if (typeof response.data === "string") {
          return response.data;
        } else if (response.data && (response.data as any).files) {
          return (response.data as any).files
            .map((file: any) => {
              const fileHeader =
                file.status === "renamed"
                  ? `diff --git a/${file.previous_filename || "unknown"} b/${file.filename}\n`
                  : `diff --git a/${file.filename} b/${file.filename}\n`;
              return `${fileHeader}${file.patch || ""}`;
            })
            .join("\n\n");
        }
        throw new Error("Unexpected response format");
      } catch (err) {
        log("warn", "Method 2 failed, trying method 3", {
          error: err instanceof Error ? err.message : "Unknown error",
        });

        // Try one more variation of the API call
        const { data } = await octokit.request(
          "GET /repos/{owner}/{repo}/commits/{commit_sha}",
          {
            owner,
            repo,
            commit_sha: commitHashToUse,
          },
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data && (data as any).files) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (
            (data as any).files
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((file: any) => {
                const fileHeader =
                  file.status === "renamed"
                    ? `diff --git a/${file.previous_filename || "unknown"} b/${file.filename}\n`
                    : `diff --git a/${file.filename} b/${file.filename}\n`;
                return `${fileHeader}${file.patch || ""}`;
              })
              .join("\n\n")
          );
        }
        throw new Error("Could not extract diff data from response");
      }
    };

    // Try each method in sequence
    const fetchMethods = [fetchMethod1, fetchMethod2];

    for (let i = 0; i < fetchMethods.length; i++) {
      try {
        diffData = await fetchMethods[i]();
        if (
          diffData &&
          typeof diffData === "string" &&
          diffData.trim().length > 0
        ) {
          break;
        }
      } catch (err) {
        log("warn", `Diff fetch method ${i + 1} failed`, {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // If all methods failed, use commit message as fallback
    if (
      !diffData ||
      typeof diffData !== "string" ||
      diffData.trim().length === 0
    ) {
      log(
        "warn",
        "All methods to fetch diff failed, using commit message as fallback",
      );
      diffData = `Commit: ${commitHashToUse}\nMessage: ${commitMessage}\n\nNo diff data available.`;
    }

    // Truncate if needed
    const truncatedData =
      diffData.length > GITHUB_CONFIG.DIFF_MAX_LENGTH
        ? diffData.substring(0, GITHUB_CONFIG.DIFF_MAX_LENGTH) +
          "\n\n[diff truncated due to size]"
        : diffData;

    log("info", `Generating AI summary for commit ${commitHashToUse}`);

    // Get AI summary
    const aiSummary = await aISummariesCommit(truncatedData);

    if (!aiSummary) {
      return "😥 Sorry, something went wrong. No summary available.";
    }

    // Update the AI summary in the database
    await db
      .update(commitsTable)
      .set({ AiSummary: aiSummary })
      .where(eq(commitsTable.id, commitRecord.id));

    log("info", `Updated AI summary for commit ${commitHashToUse}`);

    return aiSummary;
  } catch (error) {
    if (
      error instanceof GitHubValidationError ||
      error instanceof GitHubNotFoundError
    ) {
      throw error;
    }

    log("error", "Error fetching AI summary of diff", {
      githubUrl,
      commitHash,
      projectId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Return a user-friendly error message instead of throwing
    return "😥 Could not generate AI summary. Please try again later.";
  }
}
