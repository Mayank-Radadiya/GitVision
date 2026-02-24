"use server";

// ============================================================================
// GitHub Service — Issue & Pull Request Sync (GraphQL)
// ============================================================================
// Single GraphQL query fetches issues, PRs, and their nested comments.
// Replaces the REST N+1 approach that triggered hundreds of round-trips.

import { db } from "@/db";
import { issuesTable, issueCommentsTable } from "@/db/schema";
import type { GraphQLIssuesData, IssueOrPrNode } from "../types";
import { GITHUB_CONFIG, DEFAULTS, ISSUES_AND_PRS_QUERY } from "../constants";
import { GitHubError, GitHubValidationError, GitHubAPIError } from "../errors";
import { octokit } from "../client";
import { parseGitHubUrl, log } from "../utils";

/**
 * Fetches issues AND pull requests with their comments via a single
 * GraphQL query and stores them in the database.
 *
 * Fetches the INITIAL_ISSUE_COUNT most recently updated items.
 * Older issues can be synced via a "Sync Older Issues" UI button.
 *
 * @param githubUrl - Full GitHub repository URL
 * @param projectId - UUID of the project
 * @returns Counts of issues and comments stored
 */
export const syncIssuesAndComments = async (
  githubUrl: string,
  projectId: string,
): Promise<{ issuesFetched: number; commentsFetched: number }> => {
  try {
    const { owner, repo } = parseGitHubUrl(githubUrl);
    log("info", "Fetching issues + PRs via GraphQL", {
      owner,
      repo,
      projectId,
    });

    // ── Single GraphQL call for issues + PRs + inline comments ──
    const gqlResponse = await octokit.graphql<GraphQLIssuesData>(
      ISSUES_AND_PRS_QUERY,
      {
        owner,
        repo,
        issueCount: GITHUB_CONFIG.INITIAL_ISSUE_COUNT,
        prCount: GITHUB_CONFIG.INITIAL_ISSUE_COUNT,
        commentCount: GITHUB_CONFIG.COMMENTS_PER_ISSUE,
        issueCursor: null,
        prCursor: null,
      },
    );

    const batchSize = GITHUB_CONFIG.COMMIT_BATCH_SIZE;
    let issuesStored = 0;
    let commentsStored = 0;

    // ── Helper: process a list of issue/PR nodes ──
    const processNodes = async (
      nodes: IssueOrPrNode[],
      isPullRequest: boolean,
    ) => {
      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);

        const issueRows = batch.map((node) => ({
          issueNumber: node.number,
          title: node.title || "",
          body: node.body || "",
          state: node.state === "OPEN" ? "open" : "closed", // MERGED → closed
          isPullRequest,
          authorLogin: node.author?.login || DEFAULTS.NAME,
          authorAvatar: node.author?.avatarUrl || DEFAULTS.AVATAR,
          projectId,
          githubCreatedAt: new Date(node.createdAt),
          githubUpdatedAt: new Date(node.updatedAt),
          githubClosedAt: node.closedAt ? new Date(node.closedAt) : null,
        }));

        const inserted = await db
          .insert(issuesTable)
          .values(issueRows)
          .returning({
            id: issuesTable.id,
            issueNumber: issuesTable.issueNumber,
          });

        issuesStored += inserted.length;

        // ── Insert inline comments for each issue in this batch ──
        for (const dbRow of inserted) {
          const originalNode = batch.find(
            (n) => n.number === dbRow.issueNumber,
          );
          if (!originalNode?.comments?.nodes?.length) continue;

          const commentRows = originalNode.comments.nodes.map((c) => ({
            issueId: dbRow.id,
            body: c.body || "",
            authorLogin: c.author?.login || DEFAULTS.NAME,
            authorAvatar: c.author?.avatarUrl || DEFAULTS.AVATAR,
            githubCreatedAt: new Date(c.createdAt),
            githubUpdatedAt: new Date(c.updatedAt),
          }));

          await db.insert(issueCommentsTable).values(commentRows);
          commentsStored += commentRows.length;
        }
      }
    };

    // Process issues (isPullRequest = false)
    await processNodes(gqlResponse.repository.issues.nodes, false);

    // Process pull requests (isPullRequest = true)
    await processNodes(
      gqlResponse.repository.pullRequests.nodes as IssueOrPrNode[],
      true,
    );

    log(
      "info",
      `Stored ${issuesStored} issues/PRs, ${commentsStored} comments`,
      { owner, repo, projectId },
    );

    return { issuesFetched: issuesStored, commentsFetched: commentsStored };
  } catch (error) {
    if (
      error instanceof GitHubValidationError ||
      error instanceof GitHubAPIError
    ) {
      throw error;
    }
    log("error", "Error fetching/storing issues and comments", {
      githubUrl,
      projectId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new GitHubError(
      "Failed to fetch and store issues and comments",
      "ISSUE_FETCH_ERROR",
      500,
      { originalError: error instanceof Error ? error.message : String(error) },
    );
  }
};
