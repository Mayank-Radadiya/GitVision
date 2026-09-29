import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import {
  projectTables,
  commitsTable,
  projectFiles,
  issuesTable,
  issueCommentsTable,
  projectChats,
  usersTable,
  type LanguageEntry,
} from "@/db/schema";
import { eq, desc, and, count, sum, sql, gte } from "drizzle-orm";
import { inngest } from "@/src/lib/inngest/client";
import {
  spendCredits,
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

interface PickUpCard {
  type: "chat" | "commit";
  title: string;
  description: string;
  href: string;
  projectName: string;
}

export function createProjectService() {
  return {
    // ── Utility ──────────────────────────────────────────────────────────────

    /**
     * Single point of ownership verification — used before every project
     * mutation or sensitive read. Filters strictly by ownerId to prevent
     * cross-tenant data leaks.
     */
    async verifyOwnership(projectId: string, userId: string): Promise<void> {
      const project = await db
        .select({ ownerId: projectTables.ownerId })
        .from(projectTables)
        .where(
          and(
            eq(projectTables.id, projectId),
            eq(projectTables.ownerId, userId), // ← tenant isolation in one query
          ),
        )
        .limit(1);

      if (!project || project.length === 0) {
        // Intentionally vague — don't leak project existence to non-owners
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found or you do not have permission",
        });
      }
    },

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
          const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
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
              isProUser: false,
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
          // Rollback the orphaned project row if the job queue is unavailable
          await db.delete(projectTables).where(eq(projectTables.id, projectId));
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Failed to queue background sync. The project has been removed. Please ensure the background worker is running and try again.",
            cause: inngestError,
          });
        }

        // Atomic, concurrency-safe deduction. The read above is only a fast-fail
        // for the common case; this guarded UPDATE is the real authority, so two
        // concurrent requests can never drive the balance negative.
        const chargedBalance = await spendCredits(userId, PROJECT_CREATION_COST);
        const charged = chargedBalance === null ? [] : [{ credits: chargedBalance }];

        if (charged.length === 0) {
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
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to create project. Please check the repository URL and try again.",
        });
      }
    },

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

    async deleteProject(projectId: string, userId: string) {
      await this.verifyOwnership(projectId, userId);
      // ON DELETE CASCADE handles commits, files, embeddings, issues, chats
      await db.delete(projectTables).where(eq(projectTables.id, projectId));
      return { success: true, message: "Project deleted successfully" };
    },

    /**
     * Re-syncs issues and PRs for an existing project.
     * Deletes stale records first to prevent duplicates.
     */
    async syncIssues(projectId: string, userId: string) {
      await this.verifyOwnership(projectId, userId);

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

      await db.delete(issuesTable).where(eq(issuesTable.projectId, projectId));

      const result = await syncIssuesAndComments(
        project[0].githubUrl,
        projectId,
      );

      return {
        success: true,
        issuesFetched: result.issuesFetched,
        commentsFetched: result.commentsFetched,
      };
    },

    // ── Commit Queries ────────────────────────────────────────────────────────

    /**
     * Cursor-based paginated commits. Cursor is a commit ID; we use its
     * `authorDate` so the DB can use the existing `commits_author_date_idx`.
     */
    async getProjectCommits(
      projectId: string,
      userId: string,
      limit: number,
      cursor?: string,
    ) {
      await this.verifyOwnership(projectId, userId);

      const safeLimit = Math.min(limit, 100);

      let cursorDate: Date | undefined;
      if (cursor) {
        const cursorCommit = await db
          .select({ authorDate: commitsTable.authorDate })
          .from(commitsTable)
          .where(
            and(
              eq(commitsTable.id, cursor),
              eq(commitsTable.projectId, projectId), // tenant safety
            ),
          )
          .limit(1);
        cursorDate = cursorCommit[0]?.authorDate;
      }

      const whereClause = cursorDate
        ? and(
            eq(commitsTable.projectId, projectId),
            sql`${commitsTable.authorDate} < ${cursorDate}`,
          )
        : eq(commitsTable.projectId, projectId);

      const commits = await db
        .select()
        .from(commitsTable)
        .where(whereClause)
        .orderBy(desc(commitsTable.authorDate))
        .limit(safeLimit + 1); // +1 to detect if next page exists

      let nextCursor: string | undefined;
      if (commits.length > safeLimit) {
        nextCursor = commits.pop()!.id;
      }

      return { commits, nextCursor };
    },

    // ── File Queries ──────────────────────────────────────────────────────────

    /**
     * Returns the file tree with ONLY metadata (no code payload).
     * Prevents 10MB+ payloads that crash browser tabs.
     */
    async getProjectFiles(projectId: string, userId: string) {
      await this.verifyOwnership(projectId, userId);

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
      await this.verifyOwnership(projectId, userId);

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
     * Fetches ALL dashboard data in a single server call, the seven reads
     * issued in parallel so there is no sequential HTTP waterfall.
     *
     * ── Measured inventory (T-029) ───────────────────────────────────────────
     * Measured 2026-09-29 against the dev database through the `neon-http`
     * driver, for the heaviest user there (5 projects, 402 commits, 72
     * issues), 5 runs per call, medians. Re-measure before trusting these
     * again — they are a floor for one region, not a promise.
     *
     * The cost here is round-trips, not row counts. `SELECT 1` on the same
     * connection is ~72 ms, which is the floor every number below includes.
     *
     *   call                        queries  tables               median
     *   getDashboardInfo                  2  projects, users          99 ms
     *   getAllProjects                    1  projects                 83 ms
     *   getRecentActivity                 1  commits ⋈ projects      475 ms
     *   getCommitChart                    1  commits ⋈ projects       72 ms
     *   getPickUpWhereYouLeftOff          2  project_chats, commits   102 ms
     *   getLanguageBreakdown              1  projects                 99 ms
     *   getNeedsAttention                 2  issues ⋈ projects        106 ms
     *
     * So it is ten queries across seven service calls, not seven. The
     * Promise.all is working: the two-query calls cost only ~20 ms more
     * than the one-query calls, because they overlap. End-to-end
     * `getDashboardData` measured 636-1040 ms, ~717 ms median.
     *
     * getRecentActivity is the outlier, and it is not the planner's fault.
     * EXPLAIN ANALYZE on its exact SQL reports 0.134 ms of database time
     * (backward index scan on commits_author_date_idx, 10 shared buffers).
     * The time is on the wire: it returns full `commit_message` text,
     * which averages 1,092 bytes and reaches 65,536. The same query with
     * `c.id` instead is ~90 ms, and adding back author_avatar, author_name
     * or projects.name one at a time is still ~72-100 ms. Only
     * commit_message moves the number (300-775 ms). getPickUpWhereYouLeftOff
     * escapes it only because it takes the single most recent row, not 8.
     *
     * Mergeability, for whoever consolidates this next:
     *   - projects, read three times — getAllProjects (all columns),
     *     getDashboardInfo's SUM() and getLanguageBreakdown's `languages`.
     *     All three are `WHERE owner_id = ?`, and getAllProjects already
     *     returns every row, so both aggregates are derivable in JS with no
     *     extra query at all. 3 → 1.
     *   - commits ⋈ projects, read three times — getRecentActivity's top 8,
     *     getCommitChart's 7-day aggregate, and getPickUpWhereYouLeftOff's
     *     top 1. The two row reads can share one query (getRecentActivity's
     *     ordering already contains the top 1; it only needs to also select
     *     `hasSummary`). The aggregate can become `count(*) OVER ()` on the
     *     same rows. 3 → 1.
     *   - issues ⋈ projects, read twice — getNeedsAttention's count
     *     aggregate and its top 8 rows share an identical FROM and WHERE,
     *     so the count is a `count(*) OVER ()` on the same result. 2 → 1.
     *   - users (credits) and project_chats ⋈ projects (the last chat) are
     *     one row each on their own tables. Nothing to merge them into;
     *     getting from 5 requests to 3 means batching them onto the same
     *     Neon HTTP statement, not joining.
     *
     * Order matters if this is picked up: capping `commit_message` on the
     * way out buys far more than any merge above, because no merge removes
     * the 64 KB row. getRecentActivity alone is two thirds of the widget.
     */
    async getDashboardData(userId: string) {
      const [
        stats,
        projects,
        recentActivity,
        commitChart,
        pickUp,
        languages,
        attention,
      ] = await Promise.all([
        this.getDashboardInfo(userId),
        this.getAllProjects(userId),
        this.getRecentActivity(userId, 8),
        this.getCommitChart(userId, 7),
        this.getPickUpWhereYouLeftOff(userId),
        this.getLanguageBreakdown(userId),
        this.getNeedsAttention(userId),
      ]);

      return {
        stats,
        projects,
        recentActivity,
        commitChart,
        pickUp,
        languages,
        attention,
      };
    },

    async getRecentActivity(userId: string, limit = 8) {
      // Defensive bound — validated again here even if router already checks
      const safeLimit = Math.min(limit, 50);

      return db
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
        .where(eq(projectTables.ownerId, userId)) // ← tenant isolation via JOIN condition
        .orderBy(desc(commitsTable.authorDate))
        .limit(safeLimit);
    },

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

    async generateAiSummary(
      projectId: string,
      commitId: string,
      userId: string,
    ) {
      await this.verifyOwnership(projectId, userId);

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
      const remaining = await spendCredits(userId, COMMIT_SUMMARY_COST);
      if (remaining === null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You're out of credits. Please top up to generate summaries.",
        });
      }

      return getAiSummaryOfCommit(
        project.githubUrl,
        commitRecord[0].commitHash,
        projectId,
        commitId,
      );
    },

    async getPickUpWhereYouLeftOff(
      userId: string,
    ): Promise<{ cards: PickUpCard[] }> {
      const [lastChat, recentCommit] = await Promise.all([
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
            id: commitsTable.id,
            commitMessage: commitsTable.commitMessage,
            projectId: commitsTable.projectId,
            projectName: projectTables.projectName,
            authorDate: commitsTable.authorDate,
            hasSummary: sql<boolean>`${commitsTable.AiSummary} IS NOT NULL`,
          })
          .from(commitsTable)
          .innerJoin(
            projectTables,
            eq(commitsTable.projectId, projectTables.id),
          )
          .where(eq(projectTables.ownerId, userId))
          .orderBy(desc(commitsTable.authorDate))
          .limit(1),
      ]);

      const cards: PickUpCard[] = [];

      if (lastChat[0]) {
        const c = lastChat[0];
        cards.push({
          type: "chat",
          title: "Continue Conversation",
          description: c.title || "Your last chat session",
          // A chat lives at /chat/[chatId] whether or not it has a project —
          // there is no /projects route in this app.
          href: `/chat/${c.id}`,
          projectName: c.projectName ?? "General",
        });
      }

      if (recentCommit[0]) {
        const cm = recentCommit[0];
        const msg =
          cm.commitMessage.length > 60
            ? cm.commitMessage.slice(0, 57) + "..."
            : cm.commitMessage;
        cards.push({
          type: "commit",
          title: "Recent Commit",
          description: msg,
          href: `/dashboard/user-project/${cm.projectId}`,
          projectName: cm.projectName,
        });
      }

      return { cards };
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

      // Aggregate byte-sizes across all projects in JS (tiny cardinality)
      const sizeByLang = new Map<
        string,
        { color: string | null; size: number }
      >();

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

      const totalBytes = [...sizeByLang.values()].reduce(
        (s, v) => s + v.size,
        0,
      );

      return [...sizeByLang.entries()]
        .sort((a, b) => b[1].size - a[1].size) // largest first
        .slice(0, 10)
        .map(([name, { color, size }]) => ({
          name,
          color,
          size,
          percentage:
            totalBytes > 0 ? Math.round((size / totalBytes) * 1000) / 10 : 0,
        }));
    },

    /**
     * "Needs Attention" widget — open issues/PRs with AI complexity signal.
     * Now surfaces `aiComplexity` and `aiTags` so the frontend can show
     * severity badges without an extra round-trip.
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

        // Fetch items with AI triage columns included
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
            aiComplexity: issuesTable.aiComplexity, // ← new: severity badge
            aiTags: issuesTable.aiTags, // ← new: chip labels
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
     * Now includes AI triage fields so issue list views can display badges.
     */
    async getProjectIssues(
      projectId: string,
      userId: string,
      isPullRequest: boolean,
      limit = 50,
    ) {
      await this.verifyOwnership(projectId, userId);

      const safeLimit = Math.min(limit, 100);

      return db
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
          aiComplexity: issuesTable.aiComplexity,
          aiTags: issuesTable.aiTags,
          aiSummary: issuesTable.aiSummary,
        })
        .from(issuesTable)
        .where(
          and(
            eq(issuesTable.projectId, projectId),
            eq(issuesTable.isPullRequest, isPullRequest),
          ),
        )
        .orderBy(desc(issuesTable.githubUpdatedAt))
        .limit(safeLimit);
    },

    /**
     * Fetches comments for a specific issue.
     * Ownership verified through the issue → project chain.
     */
    async getIssueComments(issueId: string, userId: string) {
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

      return db
        .select({
          id: issueCommentsTable.id,
          body: issueCommentsTable.body,
          authorLogin: issueCommentsTable.authorLogin,
          authorAvatar: issueCommentsTable.authorAvatar,
          githubCreatedAt: issueCommentsTable.githubCreatedAt,
        })
        .from(issueCommentsTable)
        .where(eq(issueCommentsTable.issueId, issueId))
        .orderBy(issueCommentsTable.githubCreatedAt)
        .limit(50);
    },
  };
}
