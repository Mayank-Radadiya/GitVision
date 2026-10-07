import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "../../../../lib/trpc/init";
import {
  projectCreateSchema,
  projectIdSchema,
  projectRenameSchema,
  projectCommitsSchema,
  generateAiSummarySchema,
} from "@/src/lib/validation/schemas";
import { enforceLimits } from "@/src/lib/rate-limit";
import { createProjectService } from "./services/projectService";
import { db } from "@/db";
import { count } from "drizzle-orm";
import { projectTables, commitsTable, chatMessages } from "@/db/schema";

// Instantiate the service once, saving memory and CPU cycles
const projectService = createProjectService();

/**
 * A keyset position: `<ISO timestamp>|<uuid>`, the sort key of the last row a
 * page served. The service packs and unpacks it; this only rejects shapes it
 * would otherwise hand to Postgres as a parameter the database refuses,
 * turning a bad request into a 500.
 */
const cursorSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\|[0-9a-fA-F-]{36}$/, "Invalid cursor");

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
      // Per-user cap on heavy GitHub-backed project creation (10/hour), plus
      // an IP ceiling and the global daily backstop — see rate-limit.ts. A new
      // Clerk account resets the user budget, so the per-user cap alone is not
      // a budget.
      const rl = await enforceLimits("projectCreate", ctx.userId, ctx.req);
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

  rename: protectedProcedure
    .input(projectRenameSchema)
    .mutation(async ({ input, ctx }) => {
      return projectService.renameProject(
        input.projectId,
        ctx.userId,
        input.projectName,
      );
    }),

  getFiles: protectedProcedure
    .input(projectIdSchema)
    .query(async ({ input, ctx }) => {
      return projectService.getProjectFiles(input.projectId, ctx.userId);
    }),

  getCommits: protectedProcedure
    // Commits are keyset-paged on `(author_date, id)`, so their cursor is the
    // same `<ISO timestamp>|<uuid>` position the issue and comment cursors
    // use. `projectCommitsSchema` defaulted to a bare uuid, which is the token
    // the *previous* cursor carried — accepting it would have let a stale
    // client through the gate and then failed deeper in with a different
    // error, or worse, produced the first page again. One cursor vocabulary in
    // this file, enforced at the same gate as the others.
    .input(projectCommitsSchema.extend({ cursor: cursorSchema.optional() }))
    .query(async ({ input, ctx }) => {
      return projectService.getProjectCommits(
        input.projectId,
        ctx.userId,
        input.limit,
        input.cursor,
      );
    }),

  getFileContent: protectedProcedure
    // `.uuid()` to match getProjectDetails and getCommits, as the task asks.
    // Both columns are `uuid` in Postgres, so a bare string reached the query as
    // a value that can match nothing — and the caller could not tell that from a
    // file that genuinely does not exist. The notes/risks said to check the call
    // sites first: `code-viewer` and the project view both pass a row's `id`,
    // which is a uuid, so nothing legitimate is rejected.
    .input(z.object({ projectId: z.uuid(), fileId: z.uuid() }))
    .query(async ({ input, ctx }) => {
      return projectService.getFileContent(
        input.projectId,
        input.fileId,
        ctx.userId,
      );
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
      const rl = await enforceLimits("summary", ctx.userId, ctx.req);
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

  getLanguageBreakdown: protectedProcedure.query(async ({ ctx }) => {
    return projectService.getLanguageBreakdown(ctx.userId);
  }),

  getNeedsAttention: protectedProcedure.query(async ({ ctx }) => {
    return projectService.getNeedsAttention(ctx.userId);
  }),

  getIssues: protectedProcedure
    .input(
      z.object({
        projectId: z.uuid(),
        isPullRequest: z.boolean(),
        limit: z.number().min(1).max(100).optional().default(50),
        // `<ISO timestamp>|<uuid>`, the keyset position of the last row served.
        // Validated here so a malformed cursor is a BAD_REQUEST from tRPC
        // rather than a database error surfacing as a 500.
        cursor: cursorSchema.optional(),
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
        issueId: z.uuid(),
        limit: z.number().min(1).max(100).optional().default(50),
        cursor: cursorSchema.optional(),
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
      const rl = await enforceLimits("issuesSync", ctx.userId, ctx.req);
      if (!rl.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Issue sync limit reached. Please try again later.",
        });
      }
      return projectService.syncIssues(input.projectId, ctx.userId);
    }),

  resync: protectedProcedure
    .input(projectIdSchema)
    .mutation(async ({ input, ctx }) => {
      // Re-streams the whole tarball and re-embeds every changed file behind
      // it. The GitHub quota is the shared 5,000/hr pool, and the embedding
      // spend scales with how much the repo moved, so it gets its own hourly
      // budget rather than sharing one with the issue sync.
      const rl = await enforceLimits("projectResync", ctx.userId, ctx.req);
      if (!rl.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Re-sync limit reached. Please try again later.",
        });
      }
      return projectService.resyncProject(input.projectId, ctx.userId);
    }),

  /**
   * Platform-wide row counts for the landing page.
   *
   * The hero used to claim "50K+ Repos Analyzed" from a constant. The only
   * honest replacement is the real number, which is why this is a `COUNT(*)`
   * over three tables rather than a cached aggregate somewhere.
   *
   * Unauthenticated on purpose, so the guard is the shape of the result, not
   * the procedure: three integers with no `ownerId` filter, no row contents and
   * no ids. It reveals how much the platform holds and nothing about who owns
   * it. Anything added to the return value has to keep that true.
   *
   * `.mapWith(Number)` is belt-and-braces. Over the `neon-http` driver drizzle
   * already hands back a number for `count`, but `count` is a bigint in Postgres
   * and the same codebase guards it on `sum` at
   * `services/projectService.ts:611` — if the driver ever switches, the
   * landing page should show `1,204` and not `[object Object]`.
   *
   * Prefetched server-side in `app/page.tsx` so the numbers are in the HTML
   * for the first paint, and re-fetched by the browser for hydration.
   * `proxy.ts` allowlists exactly this one tRPC path — not the `/api/trpc`
   * prefix — so the hero can call it signed out while every other procedure
   * stays behind `auth.protect()`.
   */
  getPublicStats: publicProcedure.query(async () => {
    const [projects, commits, messages] = await Promise.all([
      db.select({ count: count().mapWith(Number) }).from(projectTables),
      db.select({ count: count().mapWith(Number) }).from(commitsTable),
      db.select({ count: count().mapWith(Number) }).from(chatMessages),
    ]);

    return {
      projectsCount: projects[0]?.count ?? 0,
      commitsCount: commits[0]?.count ?? 0,
      messagesCount: messages[0]?.count ?? 0,
    };
  }),
});
