import { z } from "zod";
import { TRPCError } from "@trpc/server";
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
import { rateLimit, keys } from "@/src/lib/rate-limit";
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

  getCredits: protectedProcedure.query(async ({ ctx }) => {
    return projectService.getCredits(ctx.userId);
  }),

  create: protectedProcedure
    .input(projectCreateSchema)
    .mutation(async ({ input, ctx }) => {
      // Per-user cap on heavy GitHub-backed project creation (10/hour)
      const rl = await rateLimit(keys.projectCreate(ctx.userId), 10, 3600);
      if (!rl.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Project creation limit reached. Please try again later.",
        });
      }
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
      // This procedure already spends a credit and a full LLM call per commit
      // (see COMMIT_SUMMARY_COST), so it is metered at the same order as chat:
      // generous enough to skim a project's commit list, not enough to loop.
      const rl = await rateLimit(keys.summary(ctx.userId), 20, 3600);
      if (!rl.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Summary generation limit reached. Please try again later.",
        });
      }
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
    .input(
      z.object({
        projectId: z.string().uuid(),
        isPullRequest: z.boolean(),
        limit: z.number().min(1).max(100).optional().default(50),
        cursor: z
          .object({
            githubUpdatedAt: z.coerce.date(),
            id: z.string().uuid(),
          })
          .optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return projectService.getProjectIssues(
        input.projectId,
        ctx.userId,
        input.isPullRequest,
        input.limit,
        input.cursor,
      );
    }),

  getIssueComments: protectedProcedure
    .input(
      z.object({
        issueId: z.string().uuid(),
        limit: z.number().min(1).max(100).optional().default(50),
        cursor: z
          .object({
            githubCreatedAt: z.coerce.date(),
            id: z.string().uuid(),
          })
          .optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      return projectService.getIssueComments(
        input.issueId,
        ctx.userId,
        input.limit,
        input.cursor,
      );
    }),

  syncIssues: protectedProcedure
    .input(projectIdSchema)
    .mutation(async ({ input, ctx }) => {
      // Delete-and-re-pull of every issue and PR in the repo. Cheap per call,
      // but the GitHub quota behind it is shared, so it gets the same hourly
      // shape as projectCreate with a tighter ceiling.
      const rl = await rateLimit(keys.issuesSync(ctx.userId), 5, 3600);
      if (!rl.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Issue sync limit reached. Please try again later.",
        });
      }
      return projectService.syncIssues(input.projectId, ctx.userId);
    }),
});
