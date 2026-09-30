import {
  check,
  integer,
  pgTable,
  varchar,
  text,
  boolean,
  index,
  unique,
  uniqueIndex,
  uuid,
  timestamp,
  jsonb,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Custom vector type for pgvector extension
const vector = customType<{
  data: number[];
  config: { dimensions: number };
  configRequired: true;
  input: number[];
  output: number[];
}>({
  dataType(config) {
    return `vector(${config.dimensions})`;
  },
  toDriver(value) {
    return JSON.stringify(value);
  },
  fromDriver(value) {
    return JSON.parse(value as string);
  },
});

export const usersTable = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().default("unknown"),
  // Nullable per D-1: Clerk OAuth users can have no email address. A shared
  // placeholder default collides on the unique constraint (23505), and NULLs
  // are exempt from uniqueness in Postgres, so many email-less users coexist.
  email: varchar("email", { length: 255 }).unique(),
  credits: integer("credits").notNull().default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Defence in depth. spendCredits already guards with `WHERE credits >= cost`,
  // so the app cannot overdraw through its own code path — this catches
  // anything that bypasses it: a hand-written UPDATE, a script, a future
  // endpoint, or a bug in a WHERE clause. Credits are a real balance.
  check("users_credits_non_negative", sql`${table.credits} >= 0`),
]);

export const projectTables = pgTable(
  "projects",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    projectName: varchar("name", { length: 255 }).notNull().default("project"),
    githubUrl: varchar("github_url", { length: 255 }).notNull(),
    ownerId: varchar("owner_id", { length: 255 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    star: integer("star").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    totalCommits: integer("total_commits").notNull().default(0),
    totalBranches: integer("total_branches").notNull().default(0),
    totalContributors: integer("total_contributors").notNull().default(0),
    totalFiles: integer("total_files").notNull().default(0),
    /**
     * Tech stack breakdown populated from GitHub's GraphQL `languages` edge.
     * Stored as JSONB array of { name: string; color: string | null; size: number; percentage: number }.
     * Null until fetched. Empty array means the repo has no detectable languages.
     */
    languages: jsonb("languages").$type<LanguageEntry[]>().default([]),
    // Embedding status tracking for deferred RAG processing
    embeddingStatus: varchar("embedding_status", { length: 20 })
      .notNull()
      .default("pending"), // Values: 'pending' | 'processing' | 'completed' | 'partial' | 'failed'
    embeddingError: text("embedding_error"), // Store error message if failed
    embeddingProgress: integer("embedding_progress").notNull().default(0), // Track progress (0-100)
    lastEmbeddingAttempt: timestamp("last_embedding_attempt"), // Track when last attempted
    estimatedTokens: integer("estimated_tokens"), // Total token count across all embeddings — used for project size gate (null = unknown, treat as large)
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      ownerIdIdx: index("owner_id_idx").on(table.ownerId),
      // A user may only track a given repository once. Without this, a
      // double-submit (or two concurrent requests) inserts two project rows
      // and bills 10 credits twice. Credits are a real balance, so the
      // database — not the client — is the thing that has to say no.
      projectsOwnerIdGithubUrlUnique: unique("projects_owner_id_github_url_unique").on(
        table.ownerId,
        table.githubUrl,
      ),
    };
  },
);

export const projectFiles = pgTable(
  "project_files",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    code: text("code").notNull(),
    language: varchar("language", { length: 50 }), // Language detection
    hash: varchar("hash", { length: 64 }), // SHA-256 hash for change detection (nullable during migration)
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectTables.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      projectIdIdx: index("project_files_project_id_idx").on(table.projectId),
      hashIdx: index("project_files_hash_idx").on(table.hash),
      // getProjectContext asks for SELECT DISTINCT language for one project
      // (vector-search.ts:91). projectId leads because that is the only
      // predicate; language follows so the DISTINCT can be answered from the
      // index in order, with no re-sort and no heap visit per file. A bare
      // language index would not help: it has to filter the whole table anyway.
      projectIdLanguageIdx: index(
        "project_files_project_id_language_idx",
      ).on(table.projectId, table.language),
      projectIdFileNameUnique: unique(
        "project_files_project_id_file_name_unique",
      ).on(table.projectId, table.fileName),
    };
  },
);

export const codeEmbeddings = pgTable(
  "code_embeddings",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectTables.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => projectFiles.id, { onDelete: "cascade" }),
    filePath: varchar("file_path", { length: 255 }).notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    chunkContent: text("chunk_content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }).notNull(), // qwen/qwen3-embedding-8b via @openrouter/sdk = 768 dims
    tokenCount: integer("token_count").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      projectIdIdx: index("embeddings_project_id_idx").on(table.projectId),
      fileIdIdx: index("embeddings_file_id_idx").on(table.fileId),
      // HNSW index for fast similarity search
      embeddingIdx: index("embeddings_vector_idx").using(
        "hnsw",
        table.embedding.op("vector_cosine_ops"),
      ),
      // searchSimilarCodeInFile narrows to a single file before ranking
      // (vector-search.ts:258-278); without this it scans every chunk in the
      // project and only then discards most of them.
      projectIdFilePathIdx: index("code_embeddings_project_id_file_path_idx").on(
        table.projectId,
        table.filePath,
      ),
    };
  },
);

export const commitsTable = pgTable(
  "commits",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    commitHash: varchar("commit_hash", { length: 255 }).notNull(),
    commitMessage: text("commit_message").notNull(),
    aiSummary: text("ai_summary"),
    authorName: varchar("author_name", { length: 255 }).notNull(),
    authorEmail: varchar("author_email", { length: 255 }).notNull(),
    authorAvatar: varchar("author_avatar", { length: 255 }),
    authorDate: timestamp("author_date").notNull(),
    committerName: varchar("committer_name", { length: 255 }).notNull(),
    committerEmail: varchar("committer_email", { length: 255 }).notNull(),
    committerDate: timestamp("committer_date").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectTables.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      projectIdIdx: index("commits_project_id_idx").on(table.projectId),
      commitHashIdx: index("commits_commit_hash_idx").on(table.commitHash),
      authorDateIdx: index("commits_author_date_idx").on(table.authorDate),
      // getCommitChart filters one user's projects then reads their commits
      // inside a date window. project_id leads so the join is an equality
      // probe per project; author_date then serves the range. The two
      // single-column indexes above cannot do both, which is why the chart
      // fell back to a sequential scan of every commit in the window.
      projectIdAuthorDateIdx: index("commits_project_id_author_date_idx").on(
        table.projectId,
        table.authorDate,
      ),
      commitHashProjectIdUnique: unique(
        "commits_commit_hash_project_id_unique",
      ).on(table.commitHash, table.projectId),
    };
  },
);

// New normalized chat tables (replacing chat_history)
export const projectChats = pgTable(
  "project_chats",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    projectId: uuid("project_id").references(() => projectTables.id, {
      onDelete: "cascade",
    }), // Nullable for general chats
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull().default("project"), // 'project' | 'general'
    title: varchar("title", { length: 255 }).notNull().default("New Chat"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      projectIdIdx: index("chats_project_id_idx").on(table.projectId),
      userIdIdx: index("chats_user_id_idx").on(table.userId),
      // chat.getAll pages one user's chats by updated_at DESC with a keyset
      // cursor (chat.ts:60-104). On its own the user_id index matches every
      // chat the user has and then sorts the page; with updated_at in the key
      // the page comes back already in order and the cursor is a range
      // condition on the same index.
      userIdUpdatedAtIdx: index("chats_user_id_updated_at_idx").on(
        table.userId,
        table.updatedAt,
      ),
      typeIdx: index("chats_type_idx").on(table.type),
    };
  },
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => projectChats.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
    content: text("content").notNull(),
    relatedFiles: jsonb("related_files").default([]), // Array of file paths
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      chatIdIdx: index("messages_chat_id_idx").on(table.chatId),
      createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
    };
  },
);

/**
 * One entry in the `languages` JSONB column of `projectTables`.
 * `percentage` is computed client-side from (size / totalSize) * 100.
 */
export interface LanguageEntry {
  name: string;
  color: string | null;
  size: number; // bytes as reported by GitHub
  percentage: number; // 0–100, rounded to 1 dp
}

export const issuesTable = pgTable(
  "issues",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    issueNumber: integer("issue_number").notNull(),
    title: text("title").notNull(),
    body: text("body"), // Can be empty or null
    state: varchar("state", { length: 20 }).notNull(), // 'open' | 'closed'
    isPullRequest: boolean("is_pull_request").notNull().default(false),
    authorLogin: varchar("author_login", { length: 255 }).notNull(),
    authorAvatar: varchar("author_avatar", { length: 255 }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectTables.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    githubCreatedAt: timestamp("github_created_at").notNull(),
    githubUpdatedAt: timestamp("github_updated_at").notNull(),
    githubClosedAt: timestamp("github_closed_at"),
    // ── AI Triage columns (populated by a deferred Gemini background job) ──
    /** One-line AI-generated description of the issue/PR intent. */
    aiSummary: text("ai_summary"),
    /** Estimated complexity: 'high' | 'medium' | 'low'. Null until processed. */
    aiComplexity: varchar("ai_complexity", { length: 10 }),
    /** Semantic tags e.g. ["Bug Fix", "Auth", "Performance"]. Null until processed. */
    aiTags: jsonb("ai_tags").$type<string[]>(),
  },
  (table) => {
    return {
      projectIdIdx: index("issues_project_id_idx").on(table.projectId),
      issueNumberIdx: index("issues_issue_number_idx").on(table.issueNumber),
      // syncIssues deletes a project's issues and re-pulls them. Without this
      // the second run doubles every row: the duplicates get distinct uuids,
      // so nothing downstream notices.
      projectIdIssueNumberUnique: unique("issues_project_id_issue_number_unique").on(
        table.projectId,
        table.issueNumber,
      ),
      // getNeedsAttention filters state = 'open' on every dashboard load.
      stateIdx: index("issues_state_idx").on(table.state),
      // Issue feeds sort by recency DESC (projectService.ts:786,837).
      githubUpdatedAtIdx: index("issues_github_updated_at_idx").on(table.githubUpdatedAt),
      // The issues/PR tab filters by project + PR-ness, then sorts by
      // recency (projectService.ts:829-837) — one index serves all three.
      projectIdIsPullRequestGithubUpdatedAtIdx: index(
        "issues_project_id_is_pull_request_github_updated_at_idx",
      ).on(table.projectId, table.isPullRequest, table.githubUpdatedAt),
    };
  },
);

/**
 * Sliding-window rate limiting counters.
 * One row per (route × subject) key; window resets when it ages out.
 */
export const rateLimitsTable = pgTable(
  "rate_limits",
  {
    limitKey: varchar("limit_key", { length: 255 }).primaryKey(),
    windowStart: timestamp("window_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
    count: integer("count").notNull().default(0),
  },
  (table) => {
    return {
      // cleanupStaleData purges by `windowStart < cutoff` on a nightly cron
      // (functions.ts:375). windowStart is not the primary key, so without this
      // that sweep is a full scan of every rate limit row ever written.
      windowStartIdx: index("rate_limits_window_start_idx").on(table.windowStart),
    };
  },
);

export const issueCommentsTable = pgTable(
  "issue_comments",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issuesTable.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    authorLogin: varchar("author_login", { length: 255 }).notNull(),
    authorAvatar: varchar("author_avatar", { length: 255 }),
    githubCreatedAt: timestamp("github_created_at").notNull(),
    githubUpdatedAt: timestamp("github_updated_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      issueIdIdx: index("issue_comments_issue_id_idx").on(table.issueId),
    };
  },
);

/**
 * Why a balance moved. Typed at the column so a misspelled reason is a
 * compile error rather than a row nobody can explain later. Kept in sync by
 * hand with the call sites in `src/lib/credits.ts`.
 */
export type CreditReason =
  | "signup_grant"
  | "project_creation"
  | "commit_summary"
  | "chat_turn"
  | "claim"
  | "daily_grant";

/**
 * Append-only ledger of every credit movement. `users.credits` is still the
 * authority on the current balance; this table is the audit trail that makes
 * the balance explainable — without it a user who drops from 100 to 0 has no
 * way to find out what they spent it on, and neither do we.
 *
 * Invariant: `sum(delta)` over a user's rows equals their balance, provided
 * every grant and every spend writes a row in the same statement that moves the
 * balance. That is why `spendCredits` and `grantCredits` are single-statement
 * CTEs rather than an UPDATE followed by an INSERT.
 *
 * `balance_after` is denormalised deliberately: a ledger you have to replay to
 * answer "what did I have yesterday" is a ledger nobody queries.
 *
 * `ref_id` carries the second, separate guarantee: at most one row per
 * non-null `ref_id`. Nullable, because a `spendCredits` row has no external
 * reference to record and a NOT NULL unique column would reject every one of
 * them; Postgres treats NULLs as distinct in a unique index, so the rows that
 * do not need a key are not constrained by it.
 */
export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),
    // Cascades so deleting a Clerk user takes their ledger with them. The
    // `user.deleted` handler in the webhook already relies on this for the
    // rest of the user's rows.
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: varchar("reason", { length: 64 })
      .$type<CreditReason>()
      .notNull(),
    balanceAfter: integer("balance_after").notNull(),
    // Idempotency key for grants that can legitimately be replayed — the 24h
    // claim and the daily cron both derive it from the user and the UTC date,
    // so a second attempt writes no second row. See `claimCredits` in
    // `src/lib/credits.ts` for how ON CONFLICT uses this.
    refId: varchar("ref_id", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      // One index, not two. It leads with `user_id` so it also serves the
      // "every row for this user" filter, and it is built ascending: a btree
      // scans backwards, so it serves the `ORDER BY created_at DESC, id DESC`
      // that the history read uses without a per-column DESC marker.
      userIdCreatedAtIdIdx: index("credit_transactions_user_id_created_at_id_idx").on(
        table.userId,
        table.createdAt,
        table.id,
      ),
      // The claim's rolling 24h check reads `user_id` + a `created_at` range and
      // filters `reason` on the rows it gets back, so the composite above
      // already serves it; this index is for the write side only — one lookup
      // per grant to reject a replayed `ref_id`.
      refIdIdx: uniqueIndex("credit_transactions_ref_id_idx").on(table.refId),
    };
  },
);
