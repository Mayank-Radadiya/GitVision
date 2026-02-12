import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { projectTables, commitsTable, projectFiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  createNewProject as createGitHubProject,
  getCommitHashes,
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
        // Create project in database with GitHub data
        const { projectId } = await createGitHubProject(
          data.repoUrl,
          data.projectName,
          userId,
        );

        // Fetch and store commits in background (async, don't await)
        getCommitHashes(data.repoUrl, projectId).catch((error) => {
          console.error(
            "[ProjectService] Error fetching commits in background:",
            error,
          );
        });

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
    ) {
      await this.verifyOwnership(projectId, userId);

      // Build the query
      const query = db
        .select()
        .from(commitsTable)
        .where(eq(commitsTable.projectId, projectId))
        .orderBy(desc(commitsTable.authorDate))
        .limit(limit + 1);

      // Fetch commits (for now, we'll use offset-style until we implement proper cursor logic)
      const commits = await query;

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
     * Fetches all project files in Sandpack format
     * @returns Sandpack-formatted files object
     */
    async getProjectFiles(projectId: string, userId: string) {
      await this.verifyOwnership(projectId, userId);

      const files = await db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.projectId, projectId));

      // Transform to Sandpack format: { "/path/to/file.js": { code: "content" } }
      const sandpackFiles: Record<string, { code: string }> = {};

      if (files && files.length > 0) {
        for (const file of files) {
          const filePath = file.fileName.startsWith("/")
            ? file.fileName
            : `/${file.fileName}`;

          sandpackFiles[filePath] = {
            code: file.code,
          };
        }
      } else {
        // Placeholder when no files exist
        sandpackFiles["/README.md"] = {
          code: `# Project Files Not Yet Processed\n\nThis project's files are being processed. Please check back in a few moments.\n\nIf this message persists, the project may not have been fully imported from GitHub.`,
        };
      }

      return {
        sandpackFiles,
        totalFiles: files?.length || 0,
        message:
          files?.length === 0
            ? "No files found - showing placeholder"
            : undefined,
      };
    },
  };
}
