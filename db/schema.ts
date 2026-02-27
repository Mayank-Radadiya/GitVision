import {
  integer,
  pgTable,
  varchar,
  text,
  boolean,
  index,
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
  email: varchar("email", { length: 255 })
    .notNull()
    .unique()
    .default("example@gmail.com"),
  credits: integer("credits").notNull().default(100),
  isProUser: boolean("is_pro_user").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const projectTables = pgTable(
  "projects",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    // Embedding status tracking for deferred RAG processing
    embeddingStatus: varchar("embedding_status", { length: 20 })
      .notNull()
      .default("pending"), // Values: 'pending' | 'processing' | 'completed' | 'failed'
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
    };
  },
);

export const projectFiles = pgTable(
  "project_files",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    };
  },
);

export const codeEmbeddings = pgTable(
  "code_embeddings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectTables.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => projectFiles.id, { onDelete: "cascade" }),
    filePath: varchar("file_path", { length: 255 }).notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    chunkContent: text("chunk_content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }).notNull(), // Gemini embedding-004 = 768 dims
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
    };
  },
);

export const commitsTable = pgTable(
  "commits",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    commitHash: varchar("commit_hash", { length: 255 }).notNull(),
    commitMessage: text("commit_message").notNull(),
    AiSummary: text("ai_summary"),
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
    };
  },
);

// New normalized chat tables (replacing chat_history)
export const projectChats = pgTable(
  "project_chats",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
      typeIdx: index("chats_type_idx").on(table.type),
    };
  },
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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

// Legacy chat history table (kept for backward compatibility - deprecated)
export const chatHistoryTable = pgTable("chat_history", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectTables.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull().default("New Chat"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const issuesTable = pgTable(
  "issues",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
  },
  (table) => {
    return {
      projectIdIdx: index("issues_project_id_idx").on(table.projectId),
      issueNumberIdx: index("issues_issue_number_idx").on(table.issueNumber),
    };
  },
);

export const issueCommentsTable = pgTable(
  "issue_comments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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