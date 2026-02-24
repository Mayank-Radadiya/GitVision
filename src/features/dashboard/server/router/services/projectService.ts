import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { projectTables, commitsTable, projectFiles } from "@/db/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import {
  createNewProject as createGitHubProject,
  getAiSummaryOfCommit,
  getRepositoryFiles,
  syncIssuesAndComments,
} from "@/src/lib/github";

/**
 * Service layer for project-related business logic
 * All functions are reusable and testable
 */
export function createProjectService() {
  return {
    /**
     * Creates a new project with GitHub integration
     * @throws {TRPCError} If GitHub API fails or user validation fails
     */
    async createProject(
      data: { projectName: string; repoUrl: string },
      userId: string,
    ) {
      try {
        // Create project in DB + fetch metadata + initial 100 commits via GraphQL
        const { projectId } = await createGitHubProject(
          data.repoUrl,
          data.projectName,
          userId,
        );

        // Extract owner/repo for tarball download
        const cleanUrl = data.repoUrl.endsWith(".git")
          ? data.repoUrl.slice(0, -4)
          : data.repoUrl;
        const parts = cleanUrl.trim().split("/");
        const owner = parts[parts.length - 2]!;
        const repo = parts[parts.length - 1]!;

        // Fetch files (tarball) + issues/PRs (GraphQL) in parallel.
        // Commits are already stored by createNewProject via GraphQL.
        await Promise.all([
          getRepositoryFiles(owner, repo, projectId),
          syncIssuesAndComments(data.repoUrl, projectId),
        ]);

        return {
          projectId,
          success: true,
          message: "Project created successfully",
        };
      } catch (error) {
        // Map GitHub errors to tRPC errors
        if (error instanceof Error) {
          const githubError = error as { code?: string; statusCode?: number };

          if (githubError.code === "GITHUB_VALIDATION_ERROR") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }

          if (githubError.code === "GITHUB_NOT_FOUND") {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "GitHub repository not found",
            });
          }

          if (githubError.code === "GITHUB_RATE_LIMIT") {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message:
                "GitHub API rate limit exceeded. Please try again later.",
            });
          }
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to create project. Please check the repository URL and try again.",
        });
      }
    },

    /**
     * Verifies that the user owns the project
     * @throws {TRPCError} FORBIDDEN if user doesn't own project
     * @throws {TRPCError} NOT_FOUND if project doesn't exist
     */
    async verifyOwnership(projectId: string, userId: string): Promise<void> {
      const project = await db
        .select({ ownerId: projectTables.ownerId })
        .from(projectTables)
        .where(eq(projectTables.id, projectId))
        .limit(1);

      if (!project || project.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      if (project[0].ownerId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to access this project",
        });
      }
    },

    /**
     * Fetches project details by ID with ownership verification
     * @throws {TRPCError} NOT_FOUND if project doesn't exist
     */
    async getProjectById(projectId: string, userId: string) {
      await this.verifyOwnership(projectId, userId);

      const project = await db
        .select()
        .from(projectTables)
        .where(eq(projectTables.id, projectId))
        .limit(1);

      if (!project || project.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      return project[0];
    },

    /**
     * Fetches project commits with cursor-based pagination
     * @returns Commits and nextCursor for pagination
     */
    async getProjectCommits(
      projectId: string,
      userId: string,
      limit: number,
      cursor?: string,
    ) {
      await this.verifyOwnership(projectId, userId);

      // If cursor is provided, fetch the cursor commit's date for proper keyset pagination
      let cursorDate: Date | undefined;
      if (cursor) {
        const cursorCommit = await db
          .select({ authorDate: commitsTable.authorDate })
          .from(commitsTable)
          .where(eq(commitsTable.id, cursor))
          .limit(1);

        cursorDate = cursorCommit[0]?.authorDate;
      }

      const baseConditions = cursorDate
        ? and(
            eq(commitsTable.projectId, projectId),
            sql`${commitsTable.authorDate} < ${cursorDate}`,
          )
        : eq(commitsTable.projectId, projectId);

      const commits = await db
        .select()
        .from(commitsTable)
        .where(baseConditions)
        .orderBy(desc(commitsTable.authorDate))
        .limit(limit + 1);

      let nextCursor: string | undefined;
      if (commits.length > limit) {
        const nextItem = commits.pop();
        nextCursor = nextItem!.id;
      }

      return {
        commits,
        nextCursor,
      };
    },

    /**
     * Fetches all project files with auto-detected language.
     * Returns a generic file list (not Sandpack-specific).
     */
    async getProjectFiles(projectId: string, userId: string) {
      await this.verifyOwnership(projectId, userId);

      const files = await db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.projectId, projectId));

      if (!files || files.length === 0) {
        return {
          files: [
            {
              path: "/README.md",
              content:
                "# Project Files Not Yet Processed\n\nThis project's files are being processed. Please check back in a few moments.\n\nIf this message persists, the project may not have been fully imported from GitHub.",
              language: "markdown",
            },
          ],
          totalFiles: 0,
        };
      }

      const fileList = files.map((file) => {
        const filePath = file.fileName.startsWith("/")
          ? file.fileName
          : `/${file.fileName}`;

        // Detect language from extension
        const ext = filePath.split(".").pop()?.toLowerCase() || "";
        const langMap: Record<string, string> = {
          ts: "typescript",
          tsx: "tsx",
          js: "javascript",
          jsx: "jsx",
          json: "json",
          md: "markdown",
          css: "css",
          scss: "scss",
          html: "html",
          xml: "xml",
          py: "python",
          go: "go",
          rs: "rust",
          java: "java",
          rb: "ruby",
          sh: "bash",
          sql: "sql",
          yaml: "yaml",
          yml: "yaml",
          toml: "toml",
        };

        return {
          path: filePath,
          content: file.code,
          language: langMap[ext] || "text",
        };
      });

      return { files: fileList, totalFiles: files.length };
    },

    /**
     * Fetches all projects owned by the user
     * @returns Array of projects ordered by creation date (newest first)
     */
    async getAllProjects(userId: string) {
      const projects = await db
        .select({
          id: projectTables.id,
          projectName: projectTables.projectName,
          githubUrl: projectTables.githubUrl,
          star: projectTables.star,
          forks: projectTables.forks,
          totalCommits: projectTables.totalCommits,
          totalBranches: projectTables.totalBranches,
          totalContributors: projectTables.totalContributors,
          embeddingStatus: projectTables.embeddingStatus,
          createdAt: projectTables.createdAt,
          updatedAt: projectTables.updatedAt,
        })
        .from(projectTables)
        .where(eq(projectTables.ownerId, userId))
        .orderBy(desc(projectTables.createdAt));

      return projects;
    },

    /**
     * Aggregates dashboard statistics for the user
     * @returns Total projects, commits, files, and user credits
     */
    async getDashboardInfo(userId: string) {
      const result = await db.execute(
        sql`SELECT
          (SELECT count(*)::int FROM projects WHERE owner_id = ${userId}) AS total_projects,
          (SELECT count(*)::int FROM commits c INNER JOIN projects p ON c.project_id = p.id WHERE p.owner_id = ${userId}) AS total_commits,
          (SELECT count(*)::int FROM project_files f INNER JOIN projects p ON f.project_id = p.id WHERE p.owner_id = ${userId}) AS total_files,
          (SELECT COALESCE(credits, 0) FROM users WHERE id = ${userId}) AS credits`,
      );

      const row = result.rows[0] as
        | {
            total_projects: number;
            total_commits: number;
            total_files: number;
            credits: number;
          }
        | undefined;

      return {
        totalProjects: Number(row?.total_projects ?? 0),
        totalCommits: Number(row?.total_commits ?? 0),
        totalFiles: Number(row?.total_files ?? 0),
        userCredits: Number(row?.credits ?? 0),
      };
    },

    /**
     * Fetches recent commit activity across all user projects.
     * Joins commits with projects to include project name.
     * @returns Latest N commits with project context
     */
    async getRecentActivity(userId: string, limit = 8) {
      const activities = await db
        .select({
          id: commitsTable.id,
          commitMessage: commitsTable.commitMessage,
          authorName: commitsTable.authorName,
          authorAvatar: commitsTable.authorAvatar,
          authorDate: commitsTable.authorDate,
          projectId: commitsTable.projectId,
          projectName: projectTables.projectName,
        })
        .from(commitsTable)
        .innerJoin(projectTables, eq(commitsTable.projectId, projectTables.id))
        .where(eq(projectTables.ownerId, userId))
        .orderBy(desc(commitsTable.authorDate))
        .limit(limit);

      return activities;
    },

    /**
     * Aggregates daily commit counts for the last N days.
     * Used for the commit frequency chart on the dashboard.
     * @returns Array of { date, commits } sorted chronologically
     */
    async getCommitChart(userId: string, days = 7) {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const result = await db
        .select({
          date: sql<string>`date_trunc('day', ${commitsTable.authorDate})::date::text`,
          commits: count(commitsTable.id),
        })
        .from(commitsTable)
        .innerJoin(projectTables, eq(commitsTable.projectId, projectTables.id))
        .where(
          sql`${projectTables.ownerId} = ${userId} AND ${commitsTable.authorDate} >= ${since}`,
        )
        .groupBy(sql`date_trunc('day', ${commitsTable.authorDate})`)
        .orderBy(sql`date_trunc('day', ${commitsTable.authorDate})`);

      return result.map((r: { date: string; commits: number }) => ({
        date: r.date,
        commits: Number(r.commits),
      }));
    },

    /**
     * Generates an AI summary for a specific commit.
     * Wraps getAiSummaryOfCommit in the service layer for tRPC mutation.
     * @throws {TRPCError} NOT_FOUND if commit doesn't exist
     */
    async generateAiSummary(
      projectId: string,
      commitId: string,
      userId: string,
    ) {
      await this.verifyOwnership(projectId, userId);

      // Get project details for GitHub URL
      const project = await this.getProjectById(projectId, userId);

      // Get commit record
      const commitRecord = await db
        .select()
        .from(commitsTable)
        .where(eq(commitsTable.id, commitId))
        .limit(1);

      if (!commitRecord || commitRecord.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Commit not found",
        });
      }

      const commit = commitRecord[0];

      // Call the AI summary generator
      const summary = await getAiSummaryOfCommit(
        project.githubUrl,
        commit.commitHash,
        projectId,
        commitId,
      );

      return summary;
    },
  };
}
