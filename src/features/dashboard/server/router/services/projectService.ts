import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import {
  projectTables,
  commitsTable,
  projectFiles,
  codeEmbeddings,
  issuesTable,
  issueCommentsTable,
  projectChats,
  usersTable,
  type LanguageEntry,
} from "@/db/schema";
import { eq, desc, and, or, lt, gt, count, sum, sql, gte } from "drizzle-orm";
import { assertProjectOwnership } from "@/src/lib/guards";
import { inngest } from "@/src/lib/inngest/client";
import { isIndexingInFlight } from "@/src/lib/indexing-status";
import {
  openCharge,
  type Charge,
  PROJECT_CREATION_COST,
  COMMIT_SUMMARY_COST,
} from "@/src/lib/credits";
import {
  createNewProject as createGitHubProject,
  getAiSummaryOfCommit,
  syncIssuesAndComments,
} from "@/src/lib/github";

// ─────────────────────────────────────────────────────────────────────────────
// Shared Types
// ─────────────────────────────────────────────────────────────────────────────


/** A decoded keyset position: the last row served, by timestamp and id. */
interface CursorPosition {
  at: Date;
  id: string;
}

/**
 * Packs a keyset position into the opaque string the client echoes back.
 *
 * Plain `<ISO timestamp>|<uuid>` rather than a signed blob: the cursor names a
 * row, and reading someone else's rows is prevented by the ownership predicate
 * in the same statement, not by hiding the position. Encoding the sort key and
 * not an offset is what makes paging stable when rows are inserted mid-walk —
 * an offset would shift the window and skip or repeat rows.
 */
function encodeCursor(at: Date, id: string): string {
  return `${at.toISOString()}|${id}`;
}

/**
 * Reads a cursor back into its timestamp and id, or `null` when absent.
 *
 * Anything unparseable is rejected here rather than handed to Postgres. A bare
 * `new Date("nonsense")` becomes `Invalid Date`, which drizzle sends as a
 * parameter the database rejects with a 500 — an opaque server error for what
 * is a bad request. The router's zod schema is the first gate; this is the
 * second, because the service is also reachable without one.
 */
function decodeCursor(cursor?: string): CursorPosition | null {
  if (!cursor) return null;
  const [at, id] = cursor.split("|");
  if (!at || !id) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
  }
  const parsed = new Date(at);
  if (Number.isNaN(parsed.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
  }
  return { at: parsed, id };
}

/**
 * Aggregate the per-project `languages` JSONB into the top-10 breakdown.
 *
 * Pure: it reads rows that have already been fetched, so the consolidated
 * dashboard read can derive the breakdown from its project rows instead of
 * issuing a third query against the same table.
 */
function aggregateLanguages(
  rows: { languages: LanguageEntry[] | null }[],
): LanguageEntry[] {
  // Aggregate byte-sizes across all projects in JS (tiny cardinality)
  const sizeByLang = new Map<string, { color: string | null; size: number }>();

  for (const row of rows) {
    if (!row.languages) continue;
    for (const lang of row.languages) {
      const existing = sizeByLang.get(lang.name);
      sizeByLang.set(lang.name, {
        color: lang.color ?? existing?.color ?? null,
        size: (existing?.size ?? 0) + lang.size,
      });
    }
  }

  if (sizeByLang.size === 0) return [];

  const totalBytes = [...sizeByLang.values()].reduce((s, v) => s + v.size, 0);

  return [...sizeByLang.entries()]
    .sort((a, b) => b[1].size - a[1].size) // largest first
    .slice(0, 10)
    .map(([name, { color, size }]) => ({
      name,
      color,
      size,
      percentage: totalBytes > 0 ? Math.round((size / totalBytes) * 1000) / 10 : 0,
    }));
}

/** Windows the activity chart offers, in days. */
export const INSIGHT_WINDOWS = [7, 30, 90] as const;
export type InsightWindow = (typeof INSIGHT_WINDOWS)[number];

/**
 * Bot and service-account authors, excluded from contributor rankings.
 *
 * This has to be a SQL predicate and not a JS filter: the contributor query
 * groups and sorts in the database, so a bot removed afterwards would already
 * have displaced a human from the top N. The patterns mirror the ones
 * `contributor-widget.tsx` and `team-tab.tsx` applied client-side before the
 * contributor counts moved server-side — one vocabulary, so the two surfaces
 * cannot disagree about who counts as a person.
 */
const BOT_AUTHOR_FILTER = sql`(
  ${commitsTable.authorName} !~* '(bot@|github-actions|vercel|dependabot|renovate|\\[bot\\])'
  AND ${commitsTable.authorEmail} !~* '(bot@|github-actions|dependabot|renovate|\\[bot\\])'
)`;

/** `YYYY-MM-DD` in UTC — the same key `date_trunc('day', …)::date::text` yields. */
function utcDayKey(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

/**
 * Expands a sparse `GROUP BY day` result into a dense ascending series.
 *
 * Postgres omits days with no rows, so the gaps are exactly the days the chart
 * most needs to draw — a quiet Tuesday has to render as a zero-height point,
 * not be absent and silently shorten the x-axis. The key format has to match
 * the SQL side (`utcDayKey` above), which is also why this lives next to the
 * query rather than in the component: a client/server timezone disagreement
 * here would shift every bucket by a day and look like a plausible chart.
 */
function densifyDailySeries(
  rows: { date: string; commits: number }[],
  since: Date,
  until: Date,
): { date: string; commits: number }[] {
  const byDay = new Map(rows.map((row) => [row.date, Number(row.commits)]));
  const series: { date: string; commits: number }[] = [];
  const cursor = new Date(
    Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()),
  );
  const end = Date.UTC(
    until.getUTCFullYear(),
    until.getUTCMonth(),
    until.getUTCDate(),
  );
  while (cursor.getTime() <= end) {
    const key = utcDayKey(cursor);
    series.push({ date: key, commits: byDay.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return series;
}

export function createProjectService() {
  return {
    // ── Project CRUD ─────────────────────────────────────────────────────────

    /**
     * Creates a new project with GitHub integration.
     * Delegates heavy work to an Inngest background job to avoid timeouts.
     */
    async createProject(
      data: { projectName: string; repoUrl: string },
      userId: string,
    ) {
      try {
        // Ensure user exists in database to prevent foreign key constraints
        // This is a fallback in case the Clerk webhook hasn't processed yet
        const userExists = await db
          .select({ id: usersTable.id, credits: usersTable.credits })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1);

        let currentCredits = 0;

        if (userExists.length === 0) {
          const { clerkClient } = await import("@clerk/nextjs/server");
          const client = await clerkClient();
          const clerkUser = await client.users.getUser(userId);
          // D-1: null, not "". An empty string on a unique column collides
          // for the second email-less user.
          const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
          const name =
            [clerkUser.firstName, clerkUser.lastName]
              .filter(Boolean)
              .join(" ") || "unknown";

          currentCredits = 100;

          await db
            .insert(usersTable)
            .values({
              id: userId,
              email,
              name,
              credits: currentCredits,
            })
            .onConflictDoNothing();
        } else {
          currentCredits = userExists[0].credits;
        }

        if (currentCredits < 10) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Insufficient AI credits. You need 10 credits to create a project.",
          });
        }

        const { projectId } = await createGitHubProject(
          data.repoUrl,
          data.projectName,
          userId,
        );

        const cleanUrl = data.repoUrl.endsWith(".git")
          ? data.repoUrl.slice(0, -4)
          : data.repoUrl;
        const parts = cleanUrl.trim().split("/");
        const owner = parts[parts.length - 2]!;
        const repo = parts[parts.length - 1]!;

        // Charge before the enqueue. A worker must never be handed a project the
        // user cannot pay for, and D-11 settled on the non-transactional neon-http
        // driver, so there is no transaction to lean on: every failure after the
        // INSERT has to compensate by hand.
        // Atomic, concurrency-safe deduction. The read above is only a fast-fail
        // for the common case; this guarded UPDATE is the real authority, so two
        // concurrent requests can never drive the balance negative.
        // `openCharge` owns the refund-once guarantee and the refund's
        // idempotency key, so the compensation below cannot double-credit and
        // cannot throw over the error it is compensating for.
        let charge: Charge | null = null;
        try {
          charge = await openCharge(
            userId,
            PROJECT_CREATION_COST,
            "project_creation",
          );
        } catch (chargeError) {
          // The charge never went through, so there is nothing to give back —
          // but the project row is already in the database, so drop it.
          await db
            .delete(projectTables)
            .where(eq(projectTables.id, projectId));
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create project. Please try again.",
            cause: chargeError,
          });
        }

        if (charge === null) {
          // Lost the race against a concurrent request that drained the balance.
          await db
            .delete(projectTables)
            .where(eq(projectTables.id, projectId));
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Insufficient AI credits. You need 10 credits to create a project.",
          });
        }

        try {
          await inngest.send({
            name: "project/created",
            data: {
              projectId,
              repoUrl: data.repoUrl,
              projectName: data.projectName,
              owner,
              repo,
            },
          });
        } catch (inngestError) {
          // Compensate in both directions: the charge landed but the user gets
          // no project, so the row goes and the credits come back. The row
          // delete stays here rather than moving into the charge handle because
          // deleting a project is not this module's business — but the credit
          // half does belong to it, and `refund()` cannot reject, so a failed
          // refund can no longer replace this error with an unrelated one.
          await db
            .delete(projectTables)
            .where(eq(projectTables.id, projectId));
          await charge.refund();
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Failed to queue background sync. The project has been removed and your credits have been refunded. Please ensure the background worker is running and try again.",
            cause: inngestError,
          });
        }

        return {
          projectId,
          success: true,
          message:
            "Project created! Files and issues are syncing in the background.",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        if (error instanceof Error) {
          const githubError = error as { code?: string };
          if (githubError.code === "GITHUB_VALIDATION_ERROR")
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          if (githubError.code === "GITHUB_NOT_FOUND")
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "GitHub repository not found",
            });
          if (githubError.code === "GITHUB_RATE_LIMIT")
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: "GitHub API rate limit exceeded.",
            });
          if (githubError.code === "PROJECT_ALREADY_EXISTS")
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "This repository has already been added to your account.",
            });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to create project. Please check the repository URL and try again.",
        });
      }
    },

    async getProjectById(projectId: string, userId: string) {
      await assertProjectOwnership(projectId, userId);

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

    async renameProject(projectId: string, userId: string, projectName: string) {
      const [project] = await db
        .update(projectTables)
        .set({ projectName, updatedAt: new Date() })
        .where(and(eq(projectTables.id, projectId), eq(projectTables.ownerId, userId)))
        .returning({ id: projectTables.id, projectName: projectTables.projectName });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return project;
    },

    async deleteProject(projectId: string, userId: string) {
      await assertProjectOwnership(projectId, userId);
      // ON DELETE CASCADE handles commits, files, embeddings, issues, chats
      await db.delete(projectTables).where(eq(projectTables.id, projectId));
      return { success: true, message: "Project deleted successfully" };
    },

    /**
     * Re-syncs issues and PRs for an existing project.
     *
     * No delete here: `syncIssuesAndComments` pulls from GitHub first and then
     * upserts, so a GitHub failure leaves the existing issues intact.
     */
    async syncIssues(projectId: string, userId: string) {
      await assertProjectOwnership(projectId, userId);

      const project = await db
        .select({ githubUrl: projectTables.githubUrl })
        .from(projectTables)
        .where(eq(projectTables.id, projectId))
        .limit(1);

      if (!project || project.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const result = await syncIssuesAndComments(
        project[0].githubUrl,
        projectId,
      );

      return {
        success: true,
        issuesFetched: result.issuesFetched,
        commentsFetched: result.commentsFetched,
        truncated: result.truncated,
      };
    },

    /**
     * Queues an incremental re-sync of a project's files (F-14).
     *
     * Returns as soon as the event is queued — the tarball stream and the
     * delta re-embedding both happen in the background, so a request that
     * waited for them would sit on a connection for minutes. `lastSyncedAt` is
     * the completion signal; it only moves when the run actually finishes.
     */
    async resyncProject(projectId: string, userId: string) {
      await assertProjectOwnership(projectId, userId);

      const project = await db
        .select({ embeddingStatus: projectTables.embeddingStatus })
        .from(projectTables)
        .where(eq(projectTables.id, projectId))
        .limit(1);

      if (!project || project.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // A full embedding run owns the project's files. Queuing a re-sync now
      // would burn a tarball download and then have the Inngest function drop
      // the result on the floor when it found the project busy, so say so
      // here instead of letting the user wait for a no-op.
      if (isIndexingInFlight(project[0].embeddingStatus)) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "This project is being indexed right now. Try again once indexing finishes.",
        });
      }

      await inngest.send({ name: "project/resync", data: { projectId } });

      return { success: true };
    },

    // ── Commit Queries ────────────────────────────────────────────────────────

    /**
     * Cursor-based paginated commits, keyset-paged on `(authorDate, id)`.
     *
     * The cursor used to be a bare commit id, which this method resolved to a
     * date with a second query. That was wrong twice over. `authorDate` is not
     * unique — a rebase lands a dozen commits on one timestamp — so
     * `authorDate < cursorDate` skipped every remaining row of a tied run,
     * silently, from the middle of the history. And a cursor naming a commit
     * that no longer exists resolved to nothing, which fell through to the
     * first page and looked like a working pager looping.
     *
     * The cursor now carries the whole sort key, so there is no lookup to do
     * and no position it can fail to resolve. `id` is the tiebreak that makes
     * the comparison strict: `lte` on the timestamp alone would loop forever on
     * a run of equal timestamps, and an `or` on the two halves is exactly the
     * row-value comparison `(authorDate, id) < (cursorDate, cursorId)`.
     */
    async getProjectCommits(
      projectId: string,
      userId: string,
      limit: number,
      cursor?: string,
    ) {
      await assertProjectOwnership(projectId, userId);

      const safeLimit = Math.min(limit, 100);
      const cursorFilter = decodeCursor(cursor);
      const filters = [eq(commitsTable.projectId, projectId)];

      if (cursorFilter) {
        // Descending order, so "after" is "older", and the predicate rides in
        // the same statement as the project filter — a second query for the
        // cursor's page would let a caller walk another tenant's commits.
        filters.push(
          or(
            lt(commitsTable.authorDate, cursorFilter.at),
            and(
              eq(commitsTable.authorDate, cursorFilter.at),
              lt(commitsTable.id, cursorFilter.id),
            ),
          )!,
        );
      }

      const commits = await db
        .select()
        .from(commitsTable)
        .where(and(...filters))
        // The id tiebreak is load-bearing, not cosmetic: without it the order
        // of equal timestamps is the planner's choice, so the cursor cannot
        // name a position inside a tied run.
        .orderBy(desc(commitsTable.authorDate), desc(commitsTable.id))
        .limit(safeLimit + 1); // +1 to detect if next page exists

      // One row past the page, purely to learn whether more exist — the same
      // slice that `getProjectIssues` uses, so the two pagers cannot drift.
      const hasMore = commits.length > safeLimit;
      const items = hasMore ? commits.slice(0, safeLimit) : commits;

      // The cursor names the last row this page *returned*, not the overflow
      // row that was dropped — pointing it at c005 would skip c005 on the
      // next page.
      const last = items[items.length - 1];
      const nextCursor = hasMore
        ? encodeCursor(last!.authorDate, last!.id)
        : undefined;

      return { commits: items, nextCursor };
    },

    // ── File Queries ──────────────────────────────────────────────────────────

    /**
     * Returns the file tree with ONLY metadata (no code payload).
     * Prevents 10MB+ payloads that crash browser tabs.
     */
    async getProjectFiles(projectId: string, userId: string) {
      await assertProjectOwnership(projectId, userId);

      const files = await db
        .select({ id: projectFiles.id, fileName: projectFiles.fileName })
        .from(projectFiles)
        .where(eq(projectFiles.projectId, projectId));

      if (!files || files.length === 0) return { files: [], totalFiles: 0 };

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

      const fileList = files.map((file) => {
        const filePath = file.fileName.startsWith("/")
          ? file.fileName
          : `/${file.fileName}`;
        const ext = filePath.split(".").pop()?.toLowerCase() || "";
        return {
          id: file.id,
          path: filePath,
          language: langMap[ext] || "text",
        };
      });

      return { files: fileList, totalFiles: files.length };
    },

    /** Fetches a single file's code content on-demand (never in bulk). */
    async getFileContent(projectId: string, fileId: string, userId: string) {
      await assertProjectOwnership(projectId, userId);

      const file = await db
        .select({ code: projectFiles.code })
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.id, fileId),
            eq(projectFiles.projectId, projectId),
          ),
        )
        .limit(1);

      if (!file || file.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File content not found",
        });
      }

      return file[0].code;
    },

    // ── Dashboard Queries ─────────────────────────────────────────────────────

    /**
     * PERF FIX: All project cards with the pre-computed `totalFiles` integer
     * and the `languages` JSONB column for the Tech Stack progress bar.
     *
     * OLD approach: an N+1 COUNT(*) on project_files per project.
     * NEW approach: single SELECT on projects — totalFiles is maintained by
     * the files service after each tarball import.
     */
    async getAllProjects(userId: string) {
      return db
        .select({
          id: projectTables.id,
          projectName: projectTables.projectName,
          githubUrl: projectTables.githubUrl,
          star: projectTables.star,
          forks: projectTables.forks,
          totalCommits: projectTables.totalCommits,
          totalBranches: projectTables.totalBranches,
          totalContributors: projectTables.totalContributors,
          totalFiles: projectTables.totalFiles, // ← pre-computed, O(1)
          languages: projectTables.languages, // ← Tech Stack JSONB
          embeddingStatus: projectTables.embeddingStatus,
          createdAt: projectTables.createdAt,
          updatedAt: projectTables.updatedAt,
        })
        .from(projectTables)
        .where(eq(projectTables.ownerId, userId))
        .orderBy(desc(projectTables.createdAt));
    },

    /**
     * PERF FIX: getDashboardInfo — eliminated the COUNT(*) JOIN on project_files.
     *
     * OLD: `SELECT count(*) FROM project_files INNER JOIN projects ...`
     *      This scanned every file row for the user — O(N files) at query time.
     *
     * NEW: `SELECT SUM(total_files) FROM projects WHERE owner_id = ?`
     *      Single index scan on the projects table (owner_id_idx). O(1) per
     *      project, not per file. For a user with 10 projects × 1000 files,
     *      this goes from 10,000 row reads → 10 row reads.
     */
    async getDashboardInfo(userId: string) {
      const [projectStats, creditsRow] = await Promise.all([
        db
          .select({
            totalCommits: sum(projectTables.totalCommits).mapWith(Number),
            // SUM(total_files) uses the pre-computed column — no file table join
            totalFiles: sum(projectTables.totalFiles).mapWith(Number),
            totalProjects: count(projectTables.id),
          })
          .from(projectTables)
          .where(eq(projectTables.ownerId, userId)),

        db
          .select({ credits: usersTable.credits })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1),
      ]);

      const stats = projectStats[0];

      return {
        totalProjects: stats?.totalProjects ?? 0,
        totalCommits: stats?.totalCommits ?? 0,
        totalFiles: stats?.totalFiles ?? 0,
        userCredits: creditsRow[0]?.credits ?? 0,
      };
    },

    /**
     * The credit balance on its own.
     *
     * The two credit readouts live outside the dashboard (the sidebar shows on
     * every page, and the create-project gauge is the only dashboard read on
     * that page), so asking for `getDashboardData` to see one integer meant
     * shipping seven queries' worth of payload to render a number. One indexed
     * column on the users primary key.
     */
    async getCredits(userId: string) {
      const row = await db
        .select({ credits: usersTable.credits })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      return row[0]?.credits ?? 0;
    },

    /**
     * Fetches ALL dashboard data in a single server call — and, as of T-030,
     * in a single database round-trip.
     *
     * ── Why this is one batch and not seven calls ────────────────────────────
     * Under D-11 option (a) the `neon-http` driver is stateless: every
     * `db.select()` is its own HTTP request. The seven reads below were
     * therefore ten HTTP requests per dashboard load, wrapped in a
     * `Promise.all` so they overlapped and wall-clock cost was the slowest
     * one rather than the sum. `db.batch()` sends its statements as a single
     * Neon HTTP transaction, so the whole widget is now one request.
     *
     * The projections below are deliberately duplicated with the standalone
     * procedures (`getAllProjects`, ...). Each of those
     * is its own tRPC query and must stay independently callable, so the
     * duplication is the price of the consolidation — not an oversight.
     *
     * Four of the ten queries are gone outright, merged into reads that were
     * happening anyway:
     *   - getDashboardInfo's SUM(total_commits)/SUM(total_files)/COUNT(id)
     *     is summed in JS from the project rows below, which are the same
     *     `WHERE owner_id = ?` rows.
     *   - getLanguageBreakdown is the same rows' `languages` JSONB.
     *   - getNeedsAttention's open-issue/open-PR counts become
     *     `FILTER (...) OVER ()` window counts on the rows it already
     *     fetches. A window function is evaluated over the whole partition
     *     before LIMIT, so the counts still cover every open issue for the
     *     user, not just the eight returned.
     *
     * The project_chats lookup and the users/credits lookup each own a table
     * nothing else in this payload reads, so they stay as their own
     * statements rather than being joined into something larger.
     *
     * ── Still the biggest remaining cost (T-029) ─────────────────────────────
     * The `commits` table `commit_message` column averages 1,092 bytes and
     * reaches 65,536, over a 72 ms network floor. EXPLAIN puts the database
     * side at 0.134 ms — this is wire width, not a slow plan. Capping the
     * column on the way out is the next lever and is deliberately not done
     * here, because the payload is a contract and truncating it changes what
     * the widget shows.
     *
     * ── Measured before/after (T-030) ────────────────────────────────────────
     * Same database, same user (5 projects, 402 commits, 72 issues), 5 runs
     * each, medians:
     *
     *                    round-trips   median   range
     *   before (T-029)          10     717 ms   636-1040 ms
     *   after                   1     424 ms   235-658 ms
     *
     * The `SELECT 1` floor on the same connection drifted 72 → 83 ms between
     * the two sessions, so read the improvement as roughly 1.7x, not more.
     * Both halves are real and they are not the same fix: the round-trips
     * went 10 → 1, and the wall clock came down by the width of the
     * commit_message column, which is still in there.
     */
    async getDashboardData(userId: string) {
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const [
        projectRows,
        creditRows,
        commitRows,
        chartRows,
        chatRows,
        issueRows,
      ] = await db.batch([
        db
          .select({
            id: projectTables.id,
            projectName: projectTables.projectName,
            githubUrl: projectTables.githubUrl,
            star: projectTables.star,
            forks: projectTables.forks,
            totalCommits: projectTables.totalCommits,
            totalBranches: projectTables.totalBranches,
            totalContributors: projectTables.totalContributors,
            totalFiles: projectTables.totalFiles,
            languages: projectTables.languages,
            embeddingStatus: projectTables.embeddingStatus,
            createdAt: projectTables.createdAt,
            updatedAt: projectTables.updatedAt,
          })
          .from(projectTables)
          .where(eq(projectTables.ownerId, userId))
          .orderBy(desc(projectTables.createdAt)),

        db
          .select({ credits: usersTable.credits })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1),

        db
          .select({
            id: commitsTable.id,
            commitMessage: commitsTable.commitMessage,
            authorName: commitsTable.authorName,
            authorAvatar: commitsTable.authorAvatar,
            authorDate: commitsTable.authorDate,
            projectId: commitsTable.projectId,
            projectName: projectTables.projectName,
            // For the pick-up card, not the activity list — stripped below.
            hasSummary: sql<boolean>`${commitsTable.aiSummary} IS NOT NULL`,
          })
          .from(commitsTable)
          .innerJoin(projectTables, eq(commitsTable.projectId, projectTables.id))
          .where(eq(projectTables.ownerId, userId))
          .orderBy(desc(commitsTable.authorDate))
          .limit(8),

        db
          .select({
            date: sql<string>`date_trunc('day', ${commitsTable.authorDate})::date::text`,
            commits: count(commitsTable.id),
          })
          .from(commitsTable)
          .innerJoin(projectTables, eq(commitsTable.projectId, projectTables.id))
          .where(
            and(
              eq(projectTables.ownerId, userId),
              sql`${commitsTable.authorDate} >= ${since}`,
            ),
          )
          .groupBy(sql`date_trunc('day', ${commitsTable.authorDate})`)
          .orderBy(sql`date_trunc('day', ${commitsTable.authorDate})`),

        db
          .select({
            id: projectChats.id,
            title: projectChats.title,
            projectId: projectChats.projectId,
            projectName: projectTables.projectName,
            updatedAt: projectChats.updatedAt,
          })
          .from(projectChats)
          .leftJoin(projectTables, eq(projectChats.projectId, projectTables.id))
          .where(eq(projectChats.userId, userId))
          .orderBy(desc(projectChats.updatedAt))
          .limit(1),

        db
          .select({
            id: issuesTable.id,
            title: issuesTable.title,
            issueNumber: issuesTable.issueNumber,
            isPullRequest: issuesTable.isPullRequest,
            authorLogin: issuesTable.authorLogin,
            authorAvatar: issuesTable.authorAvatar,
            projectId: issuesTable.projectId,
            projectName: projectTables.projectName,
            githubUpdatedAt: issuesTable.githubUpdatedAt,
            aiComplexity: issuesTable.aiComplexity,
            aiTags: issuesTable.aiTags,
            // Window counts over the whole open-issue set, stripped below.
            openIssues: sql<number>`count(*) FILTER (WHERE ${issuesTable.isPullRequest} = false) OVER ()`,
            openPRs: sql<number>`count(*) FILTER (WHERE ${issuesTable.isPullRequest} = true) OVER ()`,
          })
          .from(issuesTable)
          .innerJoin(projectTables, eq(issuesTable.projectId, projectTables.id))
          .where(
            and(
              eq(projectTables.ownerId, userId),
              eq(issuesTable.state, "open"),
            ),
          )
          .orderBy(desc(issuesTable.githubUpdatedAt))
          .limit(8),
      ]);

      const firstIssue = issueRows[0];

      return {
        stats: {
          totalProjects: projectRows.length,
          totalCommits: projectRows.reduce(
            (sum, p) => sum + (p.totalCommits ?? 0),
            0,
          ),
          totalFiles: projectRows.reduce(
            (sum, p) => sum + (p.totalFiles ?? 0),
            0,
          ),
          userCredits: creditRows[0]?.credits ?? 0,
        },
        projects: projectRows,
        commitChart: chartRows.map((r) => ({
          date: r.date,
          commits: Number(r.commits),
        })),
        languages: aggregateLanguages(projectRows),
        attention: {
          openIssuesCount: Number(firstIssue?.openIssues ?? 0),
          openPRsCount: Number(firstIssue?.openPRs ?? 0),
          items: issueRows.map(
            ({ openIssues: _issues, openPRs: _prs, ...item }) => item,
          ),
        },
      };
    },

    /**
     * Commits per day for the last `days`, for one owner.
     *
     * ── Index, and why not a generated date column (T-031) ────────────────────
     * T-031 recommended option (a): a generated/stored `author_date::date`
     * column, indexed, so the `date_trunc` grouping could be served by an
     * index. That was measured before it was built, and the grouping is not
     * the problem. Measured 2026-09-29 on the dev database through
     * `neon-http`, worst-case window (365 days, the clamp), 5 projects and
     * 402 commits for one user:
     *
     *   Seq Scan on commits  (cost=0.00..38.02 rows=276)  (actual 0.010..0.097 rows=274)
     *     Filter: (author_date >= $2)
     *     Rows Removed by Filter: 128
     *     Buffers: shared hit=33
     *   HashAggregate  (actual time=0.259..0.275 rows=65)
     *   Sort Key: (date_trunc('day', commits.author_date))
     *   Execution Time: 0.319 ms
     *
     * The scan is 0.097 ms of the 0.319; the aggregate and sort are the rest.
     * Sorting 65-274 rows is not what makes this expensive, so a column that
     * makes the *grouping* indexable would leave the scan in place and add a
     * second index to maintain. The scan is the cost, and the reason for it is
     * that `commits_author_date_idx` and `commits_project_id_idx` are each
     * single-column: neither can serve the join equality and the date range
     * together, so Postgres scans everything in the window and joins
     * afterwards — including commits belonging to *other* users, which is the
     * part that does not scale on a multi-tenant table.
     *
     * So this ships a composite `commits(project_id, author_date)`
     * (migration 0003) instead: project_id leads so the join is an equality
     * probe per project, author_date then serves the range, and the read is
     * bounded by one user's own commits.
     *
     * Honest caveat, so nobody reads a seq scan later and thinks this failed:
     * on the dev database the planner *still* chooses a sequential scan, and
     * forcing one off makes it pick `commits_author_date_idx` rather than the
     * new index. On a 33-page table that is the correct choice. The index is
     * scale insurance, not a measured speedup — T-029 already put this query
     * at the ~72 ms network floor, so there is no wall-clock win to have here.
     * The plan will change only once `commits` is large enough for the planner
     * to prefer it. See db/migrations/0003_commits_project_id_author_date_idx.notes.md.
     */
    async getCommitChart(userId: string, days = 7) {
      const safeDays = Math.min(days, 365);
      const since = new Date();
      since.setDate(since.getDate() - safeDays);

      const result = await db
        .select({
          date: sql<string>`date_trunc('day', ${commitsTable.authorDate})::date::text`,
          commits: count(commitsTable.id),
        })
        .from(commitsTable)
        .innerJoin(projectTables, eq(commitsTable.projectId, projectTables.id))
        .where(
          and(
            eq(projectTables.ownerId, userId),
            sql`${commitsTable.authorDate} >= ${since}`,
          ),
        )
        .groupBy(sql`date_trunc('day', ${commitsTable.authorDate})`)
        .orderBy(sql`date_trunc('day', ${commitsTable.authorDate})`);

      return result.map((r) => ({ date: r.date, commits: Number(r.commits) }));
    },

    /**
     * Per-project aggregates for the overview dashboard, in one round-trip.
     *
     * This exists because every number the overview shows was previously either
     * absent or wrong. `getCommitChart` aggregates across *all* of a user's
     * projects, so it cannot answer "how busy was this one". And the project
     * page's own charts were fed by `useProjectCommits`, whose first page is
     * ten rows — so a "last 7 days" chart was really "the last 10 commits,
     * bucketed", which silently stops being a chart once a project has more
     * than ten commits. The contributor widget and the team table read that
     * same slice, so their counts were fiction too.
     *
     * ── What is deliberately NOT selected ─────────────────────────────────────
     * `commits.commit_message`, nothing else. That column averages 1,092 bytes
     * and reaches 65,536 on a single row; `getDashboardData` documents at
     * length that this is wire width rather than a slow plan (EXPLAIN puts the
     * database side at 0.134 ms). A daily aggregate needs one number per day,
     * so pulling the message text to throw it away would buy nothing.
     *
     * ── Why the window is a parameter ─────────────────────────────────────────
     * The prior-period comparison, the contributor counts and the daily series
     * all have to describe the *same* window, or the trend line disagrees with
     * the bars beside it. Fetching one wide range and slicing it client-side
     * would let those drift, so the window is chosen server-side and every
     * figure is derived from the same slice. The refetch on switch is one small
     * payload — two integers and at most 90 rows.
     *
     * ── Batch ─────────────────────────────────────────────────────────────────
     * Five statements in one `db.batch`, the same shape and rationale as
     * `getDashboardData` (T-029/T-030: 10 round-trips / 717 ms → 1 / 424 ms).
     * There is no transaction here and none is needed: `neon-http` is
     * stateless (D-11), and every statement below is an independent read that
     * is individually correct, so a partially-applied batch degrades a metric
     * rather than corrupting state.
     */
    async getProjectInsights(
      projectId: string,
      userId: string,
      days: number = 30,
    ) {
      await assertProjectOwnership(projectId, userId);

      const safeDays = (INSIGHT_WINDOWS as readonly number[]).includes(days)
        ? days
        : 30;

      const now = new Date();
      // Twice the window: the second half is the prior period the trend is
      // compared against. Clamped to a whole day so the series lines up with
      // the `date_trunc('day', …)` buckets the database produces.
      const windowStart = new Date(now);
      windowStart.setUTCDate(windowStart.getUTCDate() - safeDays);
      const seriesStart = new Date(now);
      seriesStart.setUTCDate(seriesStart.getUTCDate() - safeDays * 2);

      const [
        dailyRows,
        workRows,
        contributorRows,
        indexRows,
        fileLanguageRows,
        lastCommitRows,
      ] = await db.batch([
        // 1. Commits per day across both windows, so the prior period is free.
        db
          .select({
            date: sql<string>`date_trunc('day', ${commitsTable.authorDate})::date::text`,
            commits: count(commitsTable.id),
          })
          .from(commitsTable)
          .where(
            and(
              eq(commitsTable.projectId, projectId),
              gte(commitsTable.authorDate, seriesStart),
            ),
          )
          .groupBy(sql`date_trunc('day', ${commitsTable.authorDate})`)
          .orderBy(sql`date_trunc('day', ${commitsTable.authorDate})`),

        // 2. Open/closed work-item counts plus how long the open ones have been
        //    open. One statement with conditional SUMs rather than four, so the
        //    four numbers can never be from four different points in time.
        db
          .select({
            openIssues: sql<number>`SUM(CASE WHEN ${issuesTable.isPullRequest} = false AND ${issuesTable.state} = 'open' THEN 1 ELSE 0 END)::int`,
            closedIssues: sql<number>`SUM(CASE WHEN ${issuesTable.isPullRequest} = false AND ${issuesTable.state} = 'closed' THEN 1 ELSE 0 END)::int`,
            openPullRequests: sql<number>`SUM(CASE WHEN ${issuesTable.isPullRequest} = true AND ${issuesTable.state} = 'open' THEN 1 ELSE 0 END)::int`,
            mergedPullRequests: sql<number>`SUM(CASE WHEN ${issuesTable.isPullRequest} = true AND ${issuesTable.state} = 'closed' THEN 1 ELSE 0 END)::int`,
            // `github_created_at` is the authoritative age; `created_at` is the
            // row's own insert time, which for a synced issue is the same day.
            // COALESCE to the latter so a partially-synced row still reports an
            // age instead of dropping out of the median.
            medianOpenAgeDays: sql<number | null>`percentile_cont(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM (NOW() - COALESCE(${issuesTable.githubCreatedAt}, ${issuesTable.createdAt}))) / 86400
            ) FILTER (WHERE ${issuesTable.state} = 'open')`,
          })
          .from(issuesTable)
          .where(eq(issuesTable.projectId, projectId)),

        // 3. Commit counts per person, window-scoped and bot-filtered in SQL.
        //    Grouped on the lowercased email because one person commits under
        //    several `authorName` spellings — that mismatch was the original
        //    "3 contributors" bug, and the fix belongs where the grouping is.
        db
          .select({
            email: sql<string>`LOWER(${commitsTable.authorEmail})`,
            name: sql<string>`MAX(${commitsTable.authorName})`,
            avatar: sql<string | null>`MAX(${commitsTable.authorAvatar})`,
            commits: count(commitsTable.id),
          })
          .from(commitsTable)
          .where(
            and(
              eq(commitsTable.projectId, projectId),
              gte(commitsTable.authorDate, windowStart),
              BOT_AUTHOR_FILTER,
            ),
          )
          .groupBy(sql`LOWER(${commitsTable.authorEmail})`)
          .orderBy(desc(count(commitsTable.id)))
          .limit(12),

        // 4. Index footprint. `code_embeddings` is the searchable index, so its
        //    token total is the real cost of what the project can be asked
        //    about — a number that was already in `projects.estimatedTokens`
        //    but never rendered anywhere.
        db
          .select({
            chunks: count(codeEmbeddings.id),
            tokens: sum(codeEmbeddings.tokenCount),
          })
          .from(codeEmbeddings)
          .where(eq(codeEmbeddings.projectId, projectId)),

        // 5. Files per language, for a composition that reflects what is
        //    actually stored rather than GitHub's byte-size estimate. The
        //    estimate stays authoritative for the colour and the bar; this is
        //    the count of files we hold.
        db
          .select({
            language: projectFiles.language,
            files: count(projectFiles.id),
          })
          .from(projectFiles)
          .where(
            and(
              eq(projectFiles.projectId, projectId),
              sql`${projectFiles.language} IS NOT NULL`,
            ),
          )
          .groupBy(projectFiles.language)
          .orderBy(desc(count(projectFiles.id)))
          .limit(8),

        // 6. Most recent commit of any age. Separate from the daily series
        //    because that one only covers two windows: a repository quiet for a
        //    month still needs to say "last commit 31 days ago" rather than
        //    "never".
        db
          .select({ at: sql<Date | null>`MAX(${commitsTable.authorDate})` })
          .from(commitsTable)
          .where(eq(commitsTable.projectId, projectId)),
      ]);

      const series = densifyDailySeries(dailyRows, seriesStart, now);
      const windowSeries = series.slice(-safeDays);
      const priorSeries = series.slice(-safeDays * 2, -safeDays);
      const work = workRows[0];

      return {
        days: safeDays,
        series: windowSeries,
        // Returned as a series rather than only as a total, because the chart
        // draws the prior period as a dashed ghost line and a single number
        // cannot be turned back into a shape. It is the same `densifyDailySeries`
        // output sliced once more, so no extra statement is needed.
        priorSeries,
        totals: {
          commitsInWindow: windowSeries.reduce((sum, d) => sum + d.commits, 0),
          priorWindowCommits: priorSeries.reduce((sum, d) => sum + d.commits, 0),
          activeDays: windowSeries.filter((d) => d.commits > 0).length,
        },
        lastActivityAt: lastCommitRows[0]?.at ?? null,
        work: {
          openIssues: Number(work?.openIssues ?? 0),
          closedIssues: Number(work?.closedIssues ?? 0),
          openPullRequests: Number(work?.openPullRequests ?? 0),
          mergedPullRequests: Number(work?.mergedPullRequests ?? 0),
          medianOpenAgeDays:
            work?.medianOpenAgeDays === null || work?.medianOpenAgeDays === undefined
              ? null
              : Math.round(Number(work.medianOpenAgeDays)),
        },
        contributors: contributorRows.map((row) => ({
          email: row.email,
          name: row.name,
          avatar: row.avatar,
          commits: Number(row.commits),
        })),
        index: {
          chunks: Number(indexRows[0]?.chunks ?? 0),
          tokens: Number(indexRows[0]?.tokens ?? 0),
        },
        fileLanguages: fileLanguageRows
          .filter((row) => row.language !== null)
          .map((row) => ({
            language: row.language as string,
            files: Number(row.files),
          })),
      };
    },

    async generateAiSummary(
      projectId: string,
      commitId: string,
      userId: string,
    ) {
      await assertProjectOwnership(projectId, userId);

      const project = await this.getProjectById(projectId, userId);

      const commitRecord = await db
        .select()
        .from(commitsTable)
        .where(
          and(
            eq(commitsTable.id, commitId),
            eq(commitsTable.projectId, projectId),
          ),
        )
        .limit(1);

      if (!commitRecord || commitRecord.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Commit not found" });
      }

      // Each call is a real Gemini request. Ownership alone does not bound it —
      // a user could walk every commit in their project for free — so charge
      // before doing the work, using the same atomic primitive as chat.
      const charge = await openCharge(
        userId,
        COMMIT_SUMMARY_COST,
        "commit_summary",
      );
      if (charge === null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You're out of credits. Please top up to generate summaries.",
        });
      }

      try {
        // No `settle()` here, unlike the chat route: nothing signals failure
        // after this returns, so there is no later `refund()` for a settle to
        // suppress. The `catch` is the whole story on this path.
        return await getAiSummaryOfCommit(
          project.githubUrl,
          commitRecord[0].commitHash,
          projectId,
          commitId,
        );
      } catch (error) {
        // The credit is spent above, before the work. A summary that was never
        // produced has to be paid back, or a provider outage silently charges
        // every user for a failure.
        await charge.refund();
        throw error;
      }
    },

    /**
     * PERF FIX: Language Breakdown now reads from the pre-computed
     * `languages` JSONB column on each project row instead of scanning
     * every file in `project_files`.
     *
     * OLD: Full table scan on project_files with a regex GROUP BY — O(N files).
     * NEW: Single SELECT on projects → JavaScript aggregation — O(N projects).
     *
     * For a user with 5 projects × 500 files each, this goes from 2,500 row
     * reads down to 5 row reads.
     */
    async getLanguageBreakdown(userId: string): Promise<LanguageEntry[]> {
      const rows = await db
        .select({ languages: projectTables.languages })
        .from(projectTables)
        .where(eq(projectTables.ownerId, userId));

      return aggregateLanguages(rows);
    },

    /**
     * "Needs Attention" widget — open issues/PRs across every owned project.
     */
    async getNeedsAttention(userId: string) {
      const [counts, items] = await Promise.all([
        // Aggregate open issue/PR counts in a single query using conditional SUM
        db
          .select({
            openIssues: sql<number>`SUM(CASE WHEN ${issuesTable.isPullRequest} = false THEN 1 ELSE 0 END)::int`,
            openPRs: sql<number>`SUM(CASE WHEN ${issuesTable.isPullRequest} = true THEN 1 ELSE 0 END)::int`,
          })
          .from(issuesTable)
          .innerJoin(projectTables, eq(issuesTable.projectId, projectTables.id))
          .where(
            and(
              eq(projectTables.ownerId, userId),
              eq(issuesTable.state, "open"),
            ),
          ),

        // Fetch the items themselves
        db
          .select({
            id: issuesTable.id,
            title: issuesTable.title,
            issueNumber: issuesTable.issueNumber,
            isPullRequest: issuesTable.isPullRequest,
            authorLogin: issuesTable.authorLogin,
            authorAvatar: issuesTable.authorAvatar,
            projectId: issuesTable.projectId,
            projectName: projectTables.projectName,
            githubUpdatedAt: issuesTable.githubUpdatedAt,
          })
          .from(issuesTable)
          .innerJoin(projectTables, eq(issuesTable.projectId, projectTables.id))
          .where(
            and(
              eq(projectTables.ownerId, userId),
              eq(issuesTable.state, "open"),
            ),
          )
          .orderBy(desc(issuesTable.githubUpdatedAt))
          .limit(8),
      ]);

      const countRow = counts[0];

      return {
        openIssuesCount: Number(countRow?.openIssues ?? 0),
        openPRsCount: Number(countRow?.openPRs ?? 0),
        items,
      };
    },

    // ── Issue Queries ─────────────────────────────────────────────────────────

    /**
     * Fetches paginated issues/PRs for a single project.
     *
     * Keyset paging on `(githubUpdatedAt, id)`. The previous limit-only paging
     * was not pagination: a project with 300 issues could never show issue 101,
     * and nothing in the response said 100 of 300 had come back, so the list
     * read as complete. `id` is in the key because `githubUpdatedAt` is not
     * unique — `syncIssues` upserts many rows in the same transaction and they
     * land on the same timestamp — and a timestamp-only key silently drops
     * every row that ties with the last one served.
     *
     * The AI-triage columns are deliberately absent from the projection (T-028):
     * nothing ever fills them, so selecting them only shipped three guaranteed-
     * null fields to the client. The columns stay in db/schema.ts.
     */
    async getProjectIssues(
      projectId: string,
      userId: string,
      isPullRequest: boolean,
      limit = 50,
      cursor?: string,
    ) {
      await assertProjectOwnership(projectId, userId);

      const safeLimit = Math.min(limit, 100);
      // One row past the page, purely to learn whether more exist. Counting is
      // a second query against the same rows for an answer this already has.
      const fetchLimit = safeLimit + 1;

      // The cursor rides in the same `where` as the ownership and issue/PR
      // filters. A second statement for the cursor's page would let a caller
      // page through another tenant's issues with a guessed cursor.
      const cursorFilter = decodeCursor(cursor);
      const filters = [
        eq(issuesTable.projectId, projectId),
        eq(issuesTable.isPullRequest, isPullRequest),
      ];
      if (cursorFilter) {
        // Descending order, so "after" is "older", and the id tiebreak keeps the
        // predicate strict — `lte` on the timestamp alone would loop forever on
        // a run of equal timestamps.
        filters.push(
          or(
            lt(issuesTable.githubUpdatedAt, cursorFilter.at),
            and(
              eq(issuesTable.githubUpdatedAt, cursorFilter.at),
              lt(issuesTable.id, cursorFilter.id),
            ),
          )!,
        );
      }

      const rows = await db
        .select({
          id: issuesTable.id,
          title: issuesTable.title,
          issueNumber: issuesTable.issueNumber,
          isPullRequest: issuesTable.isPullRequest,
          state: issuesTable.state,
          authorLogin: issuesTable.authorLogin,
          authorAvatar: issuesTable.authorAvatar,
          githubUpdatedAt: issuesTable.githubUpdatedAt,
          githubCreatedAt: issuesTable.githubCreatedAt,
        })
        .from(issuesTable)
        .where(and(...filters))
        .orderBy(desc(issuesTable.githubUpdatedAt), desc(issuesTable.id))
        .limit(fetchLimit);

      const hasMore = rows.length > safeLimit;
      const items = hasMore ? rows.slice(0, safeLimit) : rows;
      const last = items[items.length - 1];

      return {
        items,
        hasMore,
        nextCursor: hasMore && last ? encodeCursor(last.githubUpdatedAt, last.id) : null,
      };
    },

    /**
     * Fetches comments for a specific issue.
     * Ownership verified through the issue → project chain.
     *
     * Keyset paging on `(githubCreatedAt, id)`, ascending — a thread is read
     * top to bottom, so "after" is "newer", the opposite of the issue list.
     */
    async getIssueComments(
      issueId: string,
      userId: string,
      limit = 50,
      cursor?: string,
    ) {
      // Ownership is part of the lookup, not a second step. Splitting it out
      // made "no such issue" and "someone else's issue" two distinguishable
      // failures, which is an existence oracle for cross-tenant issue ids.
      const issue = await db
        .select({ projectId: issuesTable.projectId })
        .from(issuesTable)
        .innerJoin(projectTables, eq(issuesTable.projectId, projectTables.id))
        .where(
          and(
            eq(issuesTable.id, issueId),
            eq(projectTables.ownerId, userId),
          ),
        )
        .limit(1);

      if (!issue || issue.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      const safeLimit = Math.min(Math.max(limit, 1), 100);
      const cursorFilter = decodeCursor(cursor);
      const filters = [eq(issueCommentsTable.issueId, issueId)];
      if (cursorFilter) {
        filters.push(
          or(
            gt(issueCommentsTable.githubCreatedAt, cursorFilter.at),
            and(
              eq(issueCommentsTable.githubCreatedAt, cursorFilter.at),
              gt(issueCommentsTable.id, cursorFilter.id),
            ),
          )!,
        );
      }

      const rows = await db
        .select({
          id: issueCommentsTable.id,
          body: issueCommentsTable.body,
          authorLogin: issueCommentsTable.authorLogin,
          authorAvatar: issueCommentsTable.authorAvatar,
          githubCreatedAt: issueCommentsTable.githubCreatedAt,
        })
        .from(issueCommentsTable)
        .where(and(...filters))
        .orderBy(
          issueCommentsTable.githubCreatedAt,
          issueCommentsTable.id,
        )
        .limit(safeLimit + 1);

      const hasMore = rows.length > safeLimit;
      const comments = hasMore ? rows.slice(0, safeLimit) : rows;
      const last = comments[comments.length - 1];

      return {
        comments,
        hasMore,
        nextCursor:
          hasMore && last ? encodeCursor(last.githubCreatedAt, last.id) : null,
      };
    },
  };
}
