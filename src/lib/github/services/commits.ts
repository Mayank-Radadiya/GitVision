"use server";

// ============================================================================
// GitHub Service — Commit Fetching & AI Summary
// ============================================================================

import { db } from "@/db";
import { commitsTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { aISummariesCommit } from "@/src/lib/gemini";
import type { GitHubFile } from "../types";
import { GITHUB_CONFIG } from "../constants";
import {
  GitHubError,
  GitHubValidationError,
  GitHubAPIError,
  GitHubNotFoundError,
} from "../errors";
import { octokit, fetchWithRetry } from "../client";
import {
  parseGitHubUrl,
  createCommitData,
  buildSmartDiff,
  log,
} from "../utils";

/**
 * @deprecated Use `createNewProject` which now fetches initial commits
 * via GraphQL. This function remains for loading older commit history
 * beyond the initial 100 (e.g. a "Load More" button).
 *
 * Uses REST pagination to walk the full commit history.
 *
 * @param githubUrl - Full GitHub repository URL
 * @param projectId - UUID of the project
 * @returns Total number of commits stored
 */
export const getCommitHashes = async (
  githubUrl: string,
  projectId: string,
): Promise<number> => {
  try {
    const { owner, repo } = parseGitHubUrl(githubUrl);
    log("info", "Fetching commits from GitHub (REST paginate)", {
      owner,
      repo,
      projectId,
    });

    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      per_page: GITHUB_CONFIG.DEFAULT_PER_PAGE,
    });

    log("info", `Fetched ${commits.length} commits`, { owner, repo });

    const batchSize = GITHUB_CONFIG.COMMIT_BATCH_SIZE;
    let totalStored = 0;

    for (let i = 0; i < commits.length; i += batchSize) {
      const batch = commits.slice(i, i + batchSize);
      const rows = batch.map((c) => createCommitData(c, projectId));

      try {
        await db.insert(commitsTable).values(rows);
        totalStored += rows.length;
      } catch (dbError) {
        log("error", "Failed to store commit batch", {
          batchNumber: Math.floor(i / batchSize) + 1,
          error: dbError instanceof Error ? dbError.message : "Unknown error",
        });
        throw dbError;
      }
    }

    log("info", "Stored all commits", { totalCommits: totalStored });
    return totalStored;
  } catch (error) {
    if (
      error instanceof GitHubValidationError ||
      error instanceof GitHubAPIError
    ) {
      throw error;
    }

    log("error", "Error fetching/storing commits", {
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
 * Generates an AI summary for a specific commit.
 *
 * ── SMART DIFF TRUNCATION ──
 * Prioritizes the JSON API (fetchMethod2) so `buildSmartDiff` can
 * filter lock files and prioritize source code. Falls back to raw
 * `.diff` URL only if the JSON API fails.
 *
 * @param githubUrl - Full GitHub repository URL
 * @param commitHash - SHA hash of the commit
 * @param projectId - UUID of the project
 * @param commitId - Optional UUID of the commit record
 * @returns AI-generated summary string
 */
export async function getAiSummaryOfCommit(
  githubUrl: string,
  commitHash: string,
  projectId: string,
  commitId?: string,
): Promise<string> {
  try {
    if (!commitHash || typeof commitHash !== "string") {
      throw new GitHubValidationError("Commit hash is required");
    }
    if (!projectId || typeof projectId !== "string") {
      throw new GitHubValidationError("Project ID is required");
    }

    // ── Look up the commit in our database ──
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

    if (!existingCommit?.length) {
      throw new GitHubNotFoundError("Commit", commitId || commitHash);
    }

    const commitRecord = existingCommit[0];
    const commitHashToUse = commitRecord.commitHash || commitHash;
    const { owner, repo } = parseGitHubUrl(githubUrl);

    log("info", `Fetching diff for commit ${commitHashToUse}`, { owner, repo });

    const commitMessage = commitRecord.commitMessage || "No message available";
    let diffData = "";

    // ── Method 1: Raw .diff URL (fallback) ──
    const fetchRawDiff = async (): Promise<string> => {
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

    // ── Method 2: JSON API with smart diff filtering (preferred) ──
    const fetchJsonDiff = async (): Promise<string> => {
      try {
        const response = await octokit.request(
          "GET /repos/{owner}/{repo}/commits/{commit_sha}",
          {
            owner,
            repo,
            commit_sha: commitHashToUse,
            headers: { accept: "application/vnd.github.v3.diff" },
          },
        );

        if (typeof response.data === "string") {
          return response.data;
        }

        const filesData = response.data as { files?: GitHubFile[] };
        if (filesData?.files) {
          return buildSmartDiff(filesData.files);
        }

        throw new Error("Unexpected response format");
      } catch (err) {
        log("warn", "JSON diff failed, trying JSON fallback", {
          error: err instanceof Error ? err.message : "Unknown error",
        });

        const { data } = await octokit.request(
          "GET /repos/{owner}/{repo}/commits/{commit_sha}",
          { owner, repo, commit_sha: commitHashToUse },
        );

        const filesData = data as { files?: GitHubFile[] };
        if (filesData?.files) {
          return buildSmartDiff(filesData.files);
        }

        throw new Error("Could not extract diff data from response");
      }
    };

    // Prioritize JSON API so buildSmartDiff filters out lock files.
    // Raw diff is only a fallback.
    const fetchMethods = [fetchJsonDiff, fetchRawDiff];

    for (let i = 0; i < fetchMethods.length; i++) {
      try {
        diffData = await fetchMethods[i]();
        if (diffData?.trim().length) break;
      } catch (err) {
        log("warn", `Diff method ${i + 1} failed`, {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Fallback: commit message when no diff available
    if (!diffData?.trim().length) {
      log("warn", "All diff methods failed — using commit message as fallback");
      diffData = `Commit: ${commitHashToUse}\nMessage: ${commitMessage}\n\nNo diff data available.`;
    }

    // Smart truncation for raw diff strings (method 1)
    const truncatedData =
      diffData.length > GITHUB_CONFIG.DIFF_MAX_LENGTH
        ? diffData.substring(0, GITHUB_CONFIG.DIFF_MAX_LENGTH) +
          "\n\n[diff truncated due to size]"
        : diffData;

    log("info", `Generating AI summary for commit ${commitHashToUse}`);

    const aiSummary = await aISummariesCommit(truncatedData);

    if (!aiSummary) {
      return "😥 Sorry, something went wrong. No summary available.";
    }

    // Persist the AI summary to the database
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

    log("error", "Error generating AI summary", {
      githubUrl,
      commitHash,
      projectId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return "😥 Could not generate AI summary. Please try again later.";
  }
}
