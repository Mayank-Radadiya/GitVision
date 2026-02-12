import { router, protectedProcedure } from "../init";
import {
  projectCreateSchema,
  projectIdSchema,
  projectCommitsSchema,
} from "@/src/lib/validation/schemas";
import { createProjectService } from "../services/projectService";

/**
 * Project router - all project-related tRPC procedures
 * All procedures are protected and require Clerk authentication
 */
export const projectRouter = router({
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
});
