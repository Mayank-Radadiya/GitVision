import { z } from "zod";
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

// Instantiate the service once, saving memory and CPU cycles
const projectService = createProjectService();

export const projectRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return projectService.getAllProjects(ctx.userId);
  }),

  getDashboardInfo: protectedProcedure.query(async ({ ctx }) => {
    return projectService.getDashboardInfo(ctx.userId);
  }),

  getDashboardData: protectedProcedure.query(async ({ ctx }) => {
    return projectService.getDashboardData(ctx.userId);
  }),

  create: protectedProcedure
    .input(projectCreateSchema)
    .mutation(async ({ input, ctx }) => {
      return projectService.createProject(input, ctx.userId);
    }),

  getDetails: protectedProcedure
    .input(projectIdSchema)
    .query(async ({ input, ctx }) => {
      return projectService.getProjectById(input.projectId, ctx.userId);
    }),

  delete: protectedProcedure
    .input(projectIdSchema)
    .mutation(async ({ input, ctx }) => {
      return projectService.deleteProject(input.projectId, ctx.userId);
    }),

  getFiles: protectedProcedure
    .input(projectIdSchema)
    .query(async ({ input, ctx }) => {
      return projectService.getProjectFiles(input.projectId, ctx.userId);
    }),

  getCommits: protectedProcedure
    .input(projectCommitsSchema)
    .query(async ({ input, ctx }) => {
      return projectService.getProjectCommits(
        input.projectId,
        ctx.userId,
        input.limit,
        input.cursor,
      );
    }),

  getFileContent: protectedProcedure
    .input(z.object({ projectId: z.string(), fileId: z.string() }))
    .query(async ({ input, ctx }) => {
      return projectService.getFileContent(
        input.projectId,
        input.fileId,
        ctx.userId,
      );
    }),

  // IMPROVEMENT: Added optional limit parameter for future "View All" pages
  getRecentActivity: protectedProcedure
    .input(
      z
        .object({ limit: z.number().min(1).max(50).optional().default(8) })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      return projectService.getRecentActivity(ctx.userId, input?.limit);
    }),

  // IMPROVEMENT: Added optional days parameter for chart filtering (7, 30, 90 days)
  getCommitChart: protectedProcedure
    .input(
      z
        .object({ days: z.number().min(7).max(365).optional().default(7) })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      return projectService.getCommitChart(ctx.userId, input?.days);
    }),

  generateAiSummary: protectedProcedure
    .input(generateAiSummarySchema)
    .mutation(async ({ input, ctx }) => {
      return projectService.generateAiSummary(
        input.projectId,
        input.commitId,
        ctx.userId,
      );
    }),

  getPickUpWhereYouLeftOff: protectedProcedure.query(async ({ ctx }) => {
    return projectService.getPickUpWhereYouLeftOff(ctx.userId);
  }),

  getLanguageBreakdown: protectedProcedure.query(async ({ ctx }) => {
    return projectService.getLanguageBreakdown(ctx.userId);
  }),

  getNeedsAttention: protectedProcedure.query(async ({ ctx }) => {
    return projectService.getNeedsAttention(ctx.userId);
  }),

  getIssues: protectedProcedure
    .input(z.object({ projectId: z.string(), isPullRequest: z.boolean() }))
    .query(async ({ input, ctx }) => {
      return projectService.getProjectIssues(
        input.projectId,
        ctx.userId,
        input.isPullRequest,
      );
    }),

  getIssueComments: protectedProcedure
    .input(z.object({ issueId: z.string() }))
    .query(async ({ input, ctx }) => {
      return projectService.getIssueComments(input.issueId, ctx.userId);
    }),

  syncIssues: protectedProcedure
    .input(projectIdSchema)
    .mutation(async ({ input, ctx }) => {
      return projectService.syncIssues(input.projectId, ctx.userId);
    }),
});
