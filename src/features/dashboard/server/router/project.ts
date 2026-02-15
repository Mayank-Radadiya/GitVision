import {
  createTRPCRouter,
  protectedProcedure,
} from "../../../../lib/trpc/init";
import {
  projectCreateSchema,
  projectIdSchema,
  projectCommitsSchema,
  generateAiSummarySchema,
} from "@/src/lib/validation/schemas";
import { createProjectService } from "./services/projectService";

/**
 * Project router - all project-related tRPC procedures
 * All procedures are protected and require Clerk authentication
 */
export const projectRouter = createTRPCRouter({
  /**
   * Get all projects owned by the authenticated user
   * Protected: Requires authentication
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const service = createProjectService();
    return service.getAllProjects(ctx.userId);
  }),

  /**
   * Get aggregated dashboard statistics
   * Protected: Requires authentication
   */
  getDashboardInfo: protectedProcedure.query(async ({ ctx }) => {
    const service = createProjectService();
    return service.getDashboardInfo(ctx.userId);
  }),

  /**
   * Create a new project from GitHub repository
   * Protected: Requires authentication
   */
  create: protectedProcedure
    .input(projectCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const service = createProjectService();
      return service.createProject(input, ctx.userId);
    }),

  /**
   * Get project details by ID
   * Protected: Requires authentication + ownership verification
   */
  getDetails: protectedProcedure
    .input(projectIdSchema)
    .query(async ({ input, ctx }) => {
      const service = createProjectService();
      return service.getProjectById(input.projectId, ctx.userId);
    }),

  /**
   * Get project commits with cursor-based pagination
   * Protected: Requires authentication + ownership verification
   */
  getCommits: protectedProcedure
    .input(projectCommitsSchema)
    .query(async ({ input, ctx }) => {
      const service = createProjectService();
      return service.getProjectCommits(
        input.projectId,
        ctx.userId,
        input.limit,
        input.cursor,
      );
    }),

  /**
   * Get all project files in Sandpack format
   * Protected: Requires authentication + ownership verification
   */
  getFiles: protectedProcedure
    .input(projectIdSchema)
    .query(async ({ input, ctx }) => {
      const service = createProjectService();
      return service.getProjectFiles(input.projectId, ctx.userId);
    }),

  /**
   * Get recent commit activity across all user projects
   * Protected: Requires authentication
   */
  getRecentActivity: protectedProcedure.query(async ({ ctx }) => {
    const service = createProjectService();
    return service.getRecentActivity(ctx.userId);
  }),

  /**
   * Get daily commit counts for the commit chart
   * Protected: Requires authentication
   */
  getCommitChart: protectedProcedure.query(async ({ ctx }) => {
    const service = createProjectService();
    return service.getCommitChart(ctx.userId);
  }),

  /**
   * Generate an AI summary for a specific commit.
   * Moves server-side logic out of the client for security.
   * Protected: Requires authentication + ownership verification
   */
  generateAiSummary: protectedProcedure
    .input(generateAiSummarySchema)
    .mutation(async ({ input, ctx }) => {
      const service = createProjectService();
      return service.generateAiSummary(
        input.projectId,
        input.commitId,
        ctx.userId,
      );
    }),
});
