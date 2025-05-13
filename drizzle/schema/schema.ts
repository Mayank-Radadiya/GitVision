import {
  integer,
  pgTable,
  varchar,
  text,
  boolean,
  primaryKey,
  index,
  uuid,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const usersTable = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().default("unknown"),
  email: varchar("email", { length: 255 })
    .notNull()
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      ownerIdIdx: index("owner_id_idx").on(table.ownerId),
    };
  }
);

// User to Projects relation (for collaborators)
export const userProjectsTable = pgTable(
  "user_projects",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectTables.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull().default("viewer"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey(table.userId, table.projectId),
      userIdIdx: index("user_projects_user_id_idx").on(table.userId),
      projectIdIdx: index("user_projects_project_id_idx").on(table.projectId),
    };
  }
);

export const projectFiles = pgTable(
  "project_files",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    code: text("code").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectTables.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      projectIdIdx: index("project_files_project_id_idx").on(table.projectId),
    };
  }
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
    };
  }
);
