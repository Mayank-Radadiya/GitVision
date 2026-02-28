import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import {
  projectTables,
  commitsTable,
  projectFiles,
  issuesTable,
  projectChats,
  usersTable,
} from "@/db/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { inngest } from "@/src/lib/inngest/client";
import {
  createNewProject as createGitHubProject,
  getAiSummaryOfCommit,
} from "@/src/lib/github";

export function createProjectService() {
  return {
    /**
     * Creates a new project with GitHub integration.
     * Delegates heavy fetching to a background process to prevent Serverless timeouts.
     */
    async createProject(
      data: { projectName: string; repoUrl: string },
      userId: string,
    ) {
      try {
        // 1. Instantly create the project row & fetch initial GraphQL metadata
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

        // 2. Schedule background execution via Inngest (Prevents 504 Gateway Timeouts)
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

        // 3. Return immediately to the user so the UI loads instantly
        return {
          projectId,
          success: true,
          message:
            "Project created! Files and issues are syncing in the background.",
        };
      } catch (error) {
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
              message: "GitHub API rate limit exceeded.",
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
          message: "You do not have permission",
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

      // Cascade constraints in DB schema will handle deleting related
      // commits, files, embeddings, issues, etc.
      await db.delete(projectTables).where(eq(projectTables.id, projectId));

      return { success: true, message: "Project deleted successfully" };
    },

    /**
     * Fetches project commits with pagination and defensive limits
     */
    async getProjectCommits(
      projectId: string,
      userId: string,
      limit: number,
      cursor?: string,
    ) {
      await this.verifyOwnership(projectId, userId);

      // DEFENSIVE SCALING: Never allow the frontend to request millions of rows
      const safeLimit = Math.min(limit, 100);

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
        .limit(safeLimit + 1);

      let nextCursor: string | undefined;
      if (commits.length > safeLimit) {
        const nextItem = commits.pop();
        nextCursor = nextItem!.id;
      }

      return { commits, nextCursor };
    },

    /**
     * OPTIMIZED: Fetches ONLY the file tree (no raw code!).
     * Prevents 10MB+ payload bombs and browser freezes.
     */
    async getProjectFiles(projectId: string, userId: string) {
      await this.verifyOwnership(projectId, userId);

      // Select ONLY the metadata, specifically excluding `code`
      const files = await db
        .select({
          id: projectFiles.id,
          fileName: projectFiles.fileName,
        })
        .from(projectFiles)
        .where(eq(projectFiles.projectId, projectId));

      if (!files || files.length === 0) {
        return { files: [], totalFiles: 0 };
      }

      const fileList = files.map((file) => {
        const filePath = file.fileName.startsWith("/")
          ? file.fileName
          : `/${file.fileName}`;
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
          id: file.id,
          path: filePath,
          language: langMap[ext] || "text",
        };
      });

      return { files: fileList, totalFiles: files.length };
    },

    /**
     * NEW: Fetches the actual code content for a single file dynamically
     * Add this to your `project.ts` router!
     */
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

    async getAllProjects(userId: string) {
      return await db
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
    },

    /**
     * OPTIMIZED: Dashboard Info
     * Relies on cached columns rather than heavy `count(*)` queries.
     */
    async getDashboardInfo(userId: string) {
      // Run queries in parallel — eliminates the sequential waterfall
      const [projects, creditsRow, filesQuery] = await Promise.all([
        db
          .select({
            totalCommits: projectTables.totalCommits,
            totalFiles: projectTables.totalFiles,
          })
          .from(projectTables)
          .where(eq(projectTables.ownerId, userId)),

        db
          .select({ credits: usersTable.credits })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1),

        // Live file count for accuracy
        db
          .select({ count: count(projectFiles.id) })
          .from(projectFiles)
          .innerJoin(
            projectTables,
            eq(projectFiles.projectId, projectTables.id),
          )
          .where(eq(projectTables.ownerId, userId)),
      ]);

      return {
        totalProjects: projects.length,
        totalCommits: projects.reduce(
          (acc, p) => acc + (p.totalCommits || 0),
          0,
        ),
        totalFiles: Number(filesQuery[0]?.count || 0),
        userCredits: creditsRow[0]?.credits ?? 0,
      };
    },

    /**
     * CONSOLIDATED: Fetches ALL dashboard data in a single call.
     * Runs 7 queries in parallel instead of 7 sequential HTTP round-trips.
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
      const safeLimit = Math.min(limit, 50); // Defensive bound

      return await db
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
          sql`${projectTables.ownerId} = ${userId} AND ${commitsTable.authorDate} >= ${since}`,
        )
        .groupBy(sql`date_trunc('day', ${commitsTable.authorDate})`)
        .orderBy(sql`date_trunc('day', ${commitsTable.authorDate})`);

      return result.map((r: { date: string; commits: number }) => ({
        date: r.date,
        commits: Number(r.commits),
      }));
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
        .where(eq(commitsTable.id, commitId))
        .limit(1);

      if (!commitRecord || commitRecord.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Commit not found" });
      }

      return await getAiSummaryOfCommit(
        project.githubUrl,
        commitRecord[0].commitHash,
        projectId,
        commitId,
      );
    },

    async getPickUpWhereYouLeftOff(userId: string) {
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

      const cards: {
        type: "chat" | "file" | "commit";
        title: string;
        description: string;
        href: string;
        projectName: string;
      }[] = [];

      if (lastChat[0]) {
        const c = lastChat[0];
        cards.push({
          type: "chat",
          title: "Continue Conversation",
          description: c.title || "Your last chat session",
          href: c.projectId
            ? `/projects/${c.projectId}/chat/${c.id}`
            : `/chat/${c.id}`,
          projectName: c.projectName || "General",
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
          href: `/projects/${cm.projectId}`,
          projectName: cm.projectName,
        });
      }

      return { cards };
    },

    async getLanguageBreakdown(userId: string) {
      const rows = await db.execute(sql`
        SELECT
          LOWER(SUBSTRING(f.file_name FROM '\.([^.]+)$')) AS ext,
          COUNT(*)::int AS file_count
        FROM project_files f
        INNER JOIN projects p ON f.project_id = p.id
        WHERE p.owner_id = ${userId}
          AND f.file_name LIKE '%.%'
        GROUP BY ext
        ORDER BY file_count DESC
        LIMIT 12
      `);

      const langMap: Record<string, string> = {
        ts: "TypeScript",
        tsx: "TSX",
        js: "JavaScript",
        jsx: "JSX",
        json: "JSON",
        md: "Markdown",
        css: "CSS",
        scss: "SCSS",
        html: "HTML",
        py: "Python",
        go: "Go",
        rs: "Rust",
        java: "Java",
        rb: "Ruby",
        sh: "Shell",
        sql: "SQL",
        yaml: "YAML",
        yml: "YAML",
        toml: "TOML",
        xml: "XML",
        svg: "SVG",
        c: "C",
        cpp: "C++",
        h: "C Header",
        cs: "C#",
        php: "PHP",
        swift: "Swift",
        kt: "Kotlin",
        dart: "Dart",
        vue: "Vue",
        svelte: "Svelte",
      };

      const typedRows = rows.rows as { ext: string; file_count: number }[];
      const totalFiles = typedRows.reduce((sum, r) => sum + r.file_count, 0);

      return typedRows
        .filter((r) => r.ext)
        .map((r) => ({
          language: langMap[r.ext] || r.ext.toUpperCase(),
          ext: r.ext,
          count: r.file_count,
          percentage:
            totalFiles > 0
              ? Math.round((r.file_count / totalFiles) * 1000) / 10
              : 0,
        }))
        .slice(0, 8);
    },

    async getNeedsAttention(userId: string) {
      const [counts, items] = await Promise.all([
        db.execute(sql`
          SELECT
            SUM(CASE WHEN i.is_pull_request = false THEN 1 ELSE 0 END)::int AS open_issues,
            SUM(CASE WHEN i.is_pull_request = true THEN 1 ELSE 0 END)::int AS open_prs
          FROM issues i
          INNER JOIN projects p ON i.project_id = p.id
          WHERE p.owner_id = ${userId} AND i.state = 'open'
        `),

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

      const row = counts.rows[0] as
        | { open_issues: number; open_prs: number }
        | undefined;

      return {
        openIssuesCount: Number(row?.open_issues ?? 0),
        openPRsCount: Number(row?.open_prs ?? 0),
        items,
      };
    },

    /**
     * Fetches issues or pull requests specifically for a single project
     */
    async getProjectIssues(
      projectId: string,
      userId: string,
      isPullRequest: boolean,
    ) {
      await this.verifyOwnership(projectId, userId);

      return await db
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
        .where(
          and(
            eq(issuesTable.projectId, projectId),
            eq(issuesTable.isPullRequest, isPullRequest),
          ),
        )
        .orderBy(desc(issuesTable.githubUpdatedAt))
        .limit(50);
    },
  };
}
