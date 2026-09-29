"use server";

// ============================================================================
// GitHub Service — Issue & Pull Request Sync (GraphQL)
// ============================================================================
// Single GraphQL query fetches issues, PRs, and their nested comments.
// Replaces the REST N+1 approach that triggered hundreds of round-trips.

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { issuesTable, issueCommentsTable } from "@/db/schema";
import type { GraphQLIssuesData, IssueOrPrNode } from "../types";
import { GITHUB_CONFIG, DEFAULTS, ISSUES_AND_PRS_QUERY } from "../constants";
import { GitHubError, GitHubValidationError, GitHubAPIError } from "../errors";
import { octokit } from "../client";
import { parseGitHubUrl } from "../utils";
import { logger } from "@/src/lib/logger";

/**
 * Fetches issues AND pull requests with their comments via a single
 * GraphQL query and stores them in the database.
 *
 * Fetches the INITIAL_ISSUE_COUNT most recently updated items.
 * Older issues can be synced via a "Sync Older Issues" UI button.
 *
 * The sync is upsert-then-prune, never delete-then-repull: every row is
 * read from GitHub into memory before the first write, and each write is
 * an upsert on `issues_project_id_issue_number_unique`. An interrupted
 * sync can therefore only ever leave EXTRA rows behind — it can never
 * leave a project whose issues have been wiped, which is what a delete
 * first made possible.
 *
 * @param githubUrl - Full GitHub repository URL
 * @param projectId - UUID of the project
 * @returns Counts of issues and comments stored, plus whether the page cap
 *   stopped the pull before GitHub was exhausted
 */
export const syncIssuesAndComments = async (
  githubUrl: string,
  projectId: string,
): Promise<{
  issuesFetched: number;
  commentsFetched: number;
  truncated: boolean;
}> => {
  try {
    const { owner, repo } = parseGitHubUrl(githubUrl);
    logger.info( "Fetching issues + PRs via GraphQL", {
      owner,
      repo,
      projectId,
    });

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
        // Build the lookup once. The old code ran batch.find() per inserted
        // row, which is O(n^2) inside every batch.
        const nodesByNumber = new Map(batch.map((node) => [node.number, node]));

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

        // Upsert on the existing (projectId, issueNumber) unique constraint.
        // `set` deliberately lists only the GitHub-derived columns: the
        // ai* triage columns belong to the deferred Gemini job and must
        // survive a re-sync.
        const inserted = await db
          .insert(issuesTable)
          .values(issueRows)
          .onConflictDoUpdate({
            target: [issuesTable.projectId, issuesTable.issueNumber],
            set: {
              title: sql`excluded.title`,
              body: sql`excluded.body`,
              state: sql`excluded.state`,
              authorLogin: sql`excluded.author_login`,
              authorAvatar: sql`excluded.author_avatar`,
              githubCreatedAt: sql`excluded.github_created_at`,
              githubUpdatedAt: sql`excluded.github_updated_at`,
              githubClosedAt: sql`excluded.github_closed_at`,
            },
          })
          .returning({
            id: issuesTable.id,
            issueNumber: issuesTable.issueNumber,
          });

        issuesStored += inserted.length;

        // Comments hang off the issue id, which the upsert preserves. Replace
        // this batch's comments so a re-sync does not double them up. Doing it
        // per batch keeps a failure here scoped to the batch it hit.
        if (inserted.length > 0) {
          await db
            .delete(issueCommentsTable)
            .where(
              inArray(
                issueCommentsTable.issueId,
                inserted.map((row) => row.id),
              ),
            );
        }

        // ── Insert inline comments for each issue in this batch ──
        for (const dbRow of inserted) {
          const originalNode = nodesByNumber.get(dbRow.issueNumber);
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

    // ── Paginate through ALL issues + PRs via cursors ──
    // Each page returns pageInfo.hasNextPage + endCursor; keep following until
    // both are exhausted. MAX_ISSUE_PAGES caps runaway repos.
    const pageSize = GITHUB_CONFIG.INITIAL_ISSUE_COUNT;
    let issueCursor: string | null = null;
    let prCursor: string | null = null;
    let hasMoreIssues = true;
    let hasMorePrs = true;
    let pages = 0;

    // ── Phase 1: read every page from GitHub into memory. No database
    // writes happen in this loop, so a GitHub 500, a rate limit or a
    // dropped connection at any page leaves the project's existing issues
    // untouched.
    const issueNodes: IssueOrPrNode[] = [];
    const prNodes: IssueOrPrNode[] = [];

    while (
      (hasMoreIssues || hasMorePrs) &&
      pages < GITHUB_CONFIG.MAX_ISSUE_PAGES
    ) {
      pages++;

      const gqlResponse: GraphQLIssuesData =
        await octokit.graphql<GraphQLIssuesData>(ISSUES_AND_PRS_QUERY, {
          owner,
          repo,
          issueCount: pageSize,
          prCount: pageSize,
          commentCount: GITHUB_CONFIG.COMMENTS_PER_ISSUE,
          issueCursor,
          prCursor,
        });

      const { issues, pullRequests } = gqlResponse.repository;

      issueNodes.push(...issues.nodes);
      prNodes.push(...(pullRequests.nodes as IssueOrPrNode[]));

      hasMoreIssues = issues.pageInfo.hasNextPage;
      hasMorePrs = pullRequests.pageInfo.hasNextPage;
      issueCursor = issues.pageInfo.endCursor;
      prCursor = pullRequests.pageInfo.endCursor;

      logger.info( `Fetched issues/PRs page ${pages}`, {
        owner,
        repo,
        projectId,
        remaining: { issues: hasMoreIssues, prs: hasMorePrs },
      });
    }

    // The page cap is a safety valve, not proof that we saw everything. Report
    // it rather than presenting a capped pull as a complete one.
    const truncated = hasMoreIssues || hasMorePrs;
    if (truncated) {
      logger.warn(
        "Issue sync hit the page cap before GitHub was exhausted",
        {
          owner,
          repo,
          projectId,
          pages,
          cap: GITHUB_CONFIG.MAX_ISSUE_PAGES,
        },
      );
    }

    // ── Phase 2: the pull succeeded, so it is now safe to write ──
    await processNodes(issueNodes, false);
    await processNodes(prNodes, true);

    // ── Prune rows GitHub no longer has. Skipped when truncated: a capped
    // sync never saw the whole set, so "not in this list" does not mean
    // "gone from the repo", and deleting on that assumption loses data.
    if (!truncated) {
      const seen = [
        ...new Set([...issueNodes, ...prNodes].map((node) => node.number)),
      ];
      await db
        .delete(issuesTable)
        .where(
          seen.length > 0
            ? and(
                eq(issuesTable.projectId, projectId),
                notInArray(issuesTable.issueNumber, seen),
              )
            : eq(issuesTable.projectId, projectId),
        );
    }

    logger.info(
      `Stored ${issuesStored} issues/PRs, ${commentsStored} comments`,
      { owner, repo, projectId, truncated },
    );

    return {
      issuesFetched: issuesStored,
      commentsFetched: commentsStored,
      truncated,
    };
  } catch (error) {
    if (
      error instanceof GitHubValidationError ||
      error instanceof GitHubAPIError
    ) {
      throw error;
    }
    logger.error( "Error fetching/storing issues and comments", {
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
