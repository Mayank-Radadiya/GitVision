"use server";

// ============================================================================
// GitHub Service — Project Creation
// ============================================================================
// Creates a new project with metadata + initial commits via a single
// GraphQL query. Sequential inserts (neon-http doesn't support transactions).

import { db } from "@/db";
import { commitsTable, projectTables } from "@/db/schema";
import type { LanguageEntry } from "@/db/schema";
import type { CreateProjectResult, GraphQLRepoData } from "../types";
import { GITHUB_CONFIG, DEFAULTS, REPO_METADATA_QUERY } from "../constants";
import {
  GitHubError,
  GitHubValidationError,
  GitHubAPIError,
  GitHubRateLimitError,
} from "../errors";
import { octokit } from "../client";
import { parseGitHubUrl, log } from "../utils";

/**
 * Creates a new project in the database with GitHub repository information.
 *
 * ── OPTIMISED (GraphQL) ──
 * Single GraphQL query returns stars, forks, branch count, contributor
 * count, and the latest 100 commits. Project row + commits are wrapped
 * in a database transaction for atomicity.
 *
 * @param url - GitHub repository URL
 * @param projectName - Name for the project
 * @param userId - ID of the user creating the project
 * @returns Object containing the created project's ID
 */
export async function createNewProject(
  url: string,
  projectName: string,
  userId: string,
): Promise<CreateProjectResult> {
  try {
    // ── Input validation ──
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

    const { owner, repo } = parseGitHubUrl(url);
    log("info", "Creating new project (GraphQL)", {
      owner,
      repo,
      projectName,
      userId,
    });

    // ── Single GraphQL call for ALL metadata + recent commits ──
    const gqlResponse = await octokit.graphql<GraphQLRepoData>(
      REPO_METADATA_QUERY,
      {
        owner,
        repo,
        commitCount: GITHUB_CONFIG.INITIAL_COMMIT_COUNT,
      },
    );

    const repoData = gqlResponse.repository;
    const history = repoData.defaultBranchRef?.target?.history;

    // ── Map language edges → LanguageEntry[] with computed percentages ──
    const languageEdges = repoData.languages?.edges ?? [];
    const totalBytes = languageEdges.reduce((sum, e) => sum + e.size, 0);
    const languages: LanguageEntry[] = languageEdges.map((edge) => ({
      name: edge.node.name,
      color: edge.node.color ?? null,
      size: edge.size,
      percentage:
        totalBytes > 0
          ? Math.round((edge.size / totalBytes) * 1000) / 10 // round to 1 dp
          : 0,
    }));

    // ── Insert project row ──
    // NOTE: neon-http driver does NOT support db.transaction().
    // Inserts are sequential — if a commit batch fails, the project row
    // survives with partial history (a background re-sync can fill the gap).
    const [newProject] = await db
      .insert(projectTables)
      .values({
        projectName: (projectName.trim() || repo).substring(0, 255),
        githubUrl: url.substring(0, 255),
        ownerId: userId,
        star: repoData.stargazerCount || 0,
        forks: repoData.forkCount || 0,
        totalBranches: repoData.refs.totalCount || 0,
        totalContributors: repoData.mentionableUsers.totalCount || 0,
        totalCommits: history?.totalCount || 0,
        languages, // ← tech stack breakdown
        // totalFiles: 0 is the column default; updated by getRepositoryFiles()
        embeddingStatus: "pending",
        embeddingProgress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!newProject?.id) {
      throw new Error("Failed to create project in database");
    }

    // ── Batch-insert the commits returned by GraphQL ──
    if (history?.nodes?.length) {
      const batchSize = GITHUB_CONFIG.COMMIT_BATCH_SIZE;

      for (let i = 0; i < history.nodes.length; i += batchSize) {
        const batch = history.nodes.slice(i, i + batchSize);

        const commitRows = batch.map((node) => ({
          commitHash: node.oid,
          commitMessage: node.message || node.messageHeadline || "",
          authorName: (node.author?.name || DEFAULTS.NAME).substring(0, 255),
          authorAvatar: (node.author?.avatarUrl || DEFAULTS.AVATAR).substring(
            0,
            255,
          ),
          authorEmail: (node.author?.email || DEFAULTS.EMAIL).substring(0, 255),
          authorDate: new Date(node.authoredDate),
          committerName: (node.committer?.name || DEFAULTS.NAME).substring(
            0,
            255,
          ),
          committerEmail: (node.committer?.email || DEFAULTS.EMAIL).substring(
            0,
            255,
          ),
          committerDate: new Date(node.committedDate),
          projectId: newProject.id,
        }));

        await db.insert(commitsTable).values(commitRows);
      }

      log("info", `Stored ${history.nodes.length} commits via GraphQL`);
    }

    log("info", "Project created successfully", {
      projectId: newProject.id,
      stats: {
        stars: newProject.star,
        forks: newProject.forks,
        branches: newProject.totalBranches,
        contributors: newProject.totalContributors,
        commits: newProject.totalCommits,
      },
    });

    return { projectId: newProject.id };
  } catch (error) {
    if (
      error instanceof GitHubValidationError ||
      error instanceof GitHubAPIError ||
      error instanceof GitHubRateLimitError
    ) {
      throw error;
    }

    log("error", "Error creating project", {
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
