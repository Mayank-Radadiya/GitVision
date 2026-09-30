import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../../../../lib/trpc/init";
import { db } from "@/db";
import {
  projectChats,
  chatMessages,
  projectTables,
  projectFiles,
} from "@/db/schema";
import { eq, and, desc, lt, like, or, sql } from "drizzle-orm";
import { assertProjectOwnership } from "@/src/lib/guards";
import { parsePackageJsonDeps } from "@/src/features/chat/lib/starter-chips";

const DEFAULT_CHAT_LIMIT = 30;
const MAX_CHAT_LIMIT = 100;
const DEFAULT_MESSAGE_LIMIT = 100;
const MAX_MESSAGE_LIMIT = 300;

/**
 * Dependency names for the starter chips (F-03), read from the `package.json`
 * the tarball extractor already stored.
 *
 * `orderBy(length(fileName))` is the monorepo tie-break: a workspace has
 * `apps/web/package.json` alongside a root one, and the root is the one that
 * describes the repository. `package-lock.json` cannot match — the pattern
 * requires a path separator immediately before `package.json`.
 *
 * No ownership check: the caller reached this with a chat row already filtered
 * on `project_chats.user_id`, and that row carries the project id.
 */
async function getProjectDependencies(projectId: string): Promise<string[]> {
  const [manifest] = await db
    .select({ code: projectFiles.code })
    .from(projectFiles)
    .where(
      and(
        eq(projectFiles.projectId, projectId),
        or(
          eq(projectFiles.fileName, "package.json"),
          like(projectFiles.fileName, "%/package.json"),
        ),
      ),
    )
    .orderBy(sql`length(${projectFiles.fileName})`)
    .limit(1);

  return parsePackageJsonDeps(manifest?.code);
}

export const chatRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(["project", "general"]),
        projectId: z.uuid().optional(),
        title: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.type === "project" && !input.projectId) {
        // A TRPCError with a specific code, not a bare Error: tRPC turns a bare
        // Error into INTERNAL_SERVER_ERROR, which is the one code the formatter
        // masks in production — so a plain validation failure reached the user
        // as an opaque "An error occurred".
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Project ID required for project chats",
        });
      }

      // Tenant isolation: never link a chat to a project the user doesn't own
      if (input.type === "project" && input.projectId) {
        try {
          await assertProjectOwnership(input.projectId, ctx.userId);
        } catch {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found or you do not have permission",
          });
        }
      }

      const [chat] = await db
        .insert(projectChats)
        .values({
          projectId: input.type === "project" ? input.projectId! : null,
          userId: ctx.userId,
          type: input.type,
          title:
            input.title ??
            (input.type === "general" ? "General Chat" : "Project Chat"),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return chat;
    }),

  getAll: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(["project", "general", "all"]).optional().default("all"),
          limit: z.number().int().min(1).max(MAX_CHAT_LIMIT).default(DEFAULT_CHAT_LIMIT),
          // Keyset cursor: the updatedAt of the last row from the previous page.
          cursor: z.iso.datetime().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const type = input?.type ?? "all";
      const limit = input?.limit ?? DEFAULT_CHAT_LIMIT;
      const conditions = [eq(projectChats.userId, ctx.userId)];

      if (type === "project") {
        conditions.push(eq(projectChats.type, "project"));
      } else if (type === "general") {
        conditions.push(eq(projectChats.type, "general"));
      }

      if (input?.cursor) {
        conditions.push(lt(projectChats.updatedAt, new Date(input.cursor)));
      }

      // Fetch one extra row to tell "there is another page" from "this was the
      // last page" without a second COUNT query.
      const rows = await db
        .select()
        .from(projectChats)
        .where(and(...conditions))
        .orderBy(desc(projectChats.updatedAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items[items.length - 1];

      return {
        items,
        nextCursor:
          hasMore && last ? last.updatedAt.toISOString() : null,
      };
    }),

  getById: protectedProcedure
    .input(
      z.object({
        chatId: z.uuid(),
        messageLimit: z
          .number()
          .int()
          .min(1)
          .max(MAX_MESSAGE_LIMIT)
          .default(DEFAULT_MESSAGE_LIMIT),
      }),
    )
    .query(async ({ input, ctx }) => {
      // The page needs the project name too, so join it in rather than making
      // the caller run a second query for a key the chat row already carries.
      // `languages` rides the same join: the empty chat state renders
      // project-specific starter chips (F-03) and would otherwise open a second
      // round trip for a column the joined row already has.
      const [chat] = await db
        .select({
          id: projectChats.id,
          projectId: projectChats.projectId,
          userId: projectChats.userId,
          type: projectChats.type,
          title: projectChats.title,
          createdAt: projectChats.createdAt,
          updatedAt: projectChats.updatedAt,
          projectName: projectTables.projectName,
          languages: projectTables.languages,
        })
        .from(projectChats)
        .leftJoin(projectTables, eq(projectChats.projectId, projectTables.id))
        .where(
          and(
            eq(projectChats.id, input.chatId),
            eq(projectChats.userId, ctx.userId),
          ),
        )
        .limit(1);

      if (!chat) {
        // Same reason as the throw in `create` above. Note the message is safe
        // to surface: it says nothing about whether the chat exists but belongs
        // to someone else, which is what the `userId` predicate already folds
        // into a single "not found".
        throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
      }

      // Take the newest N messages, then flip them back to chronological order
      // so the AI SDK still sees the conversation in the order it happened.
      const newest = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, input.chatId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(input.messageLimit + 1);

      const hasMoreMessages = newest.length > input.messageLimit;
      const messages = hasMoreMessages
        ? newest.slice(0, input.messageLimit)
        : newest;

      // Dependency names for the starter chips. There is no `dependencies`
      // column — ingestion never parsed one — so the source of truth is the
      // `package.json` the tarball extractor already stored in `project_files`.
      // A repo with no `package.json` (Go, Rust) simply has no chips gated on
      // dependencies, so the miss is the normal path, not an error.
      const dependencies = chat.projectId
        ? await getProjectDependencies(chat.projectId)
        : [];

      // The UI wants language *names*; `color`/`size`/`percentage` are a
      // rendering detail of the overview widget. Ordered by share so the
      // architecture chip names the dominant stack deterministically.
      const languageNames = [...(chat.languages ?? [])]
        .sort((a, b) => b.percentage - a.percentage)
        .map((l) => l.name);

      return {
        ...chat,
        languages: languageNames,
        dependencies,
        messages: messages.reverse(),
        hasMoreMessages,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ chatId: z.uuid() }))
    .mutation(async ({ input, ctx }) => {
      // `.returning()` is what makes the answer honest. Without it the DELETE
      // is fire-and-forget, and `{ success: true }` claimed a chat was gone
      // when the statement may well have matched nothing.
      //
      // `userId` stays in the same WHERE rather than becoming a second query,
      // and a miss stays a miss. "Not yours" and "not there" are both a single
      // zero-row delete and both answer `deleted: false`: telling them apart
      // would be an existence oracle, letting a caller enumerate chat ids and
      // learn which are real. This matches `getById`, which already folds
      // "exists but is somebody else's" into the same NOT_FOUND.
      const deleted = await db
        .delete(projectChats)
        .where(
          and(
            eq(projectChats.id, input.chatId),
            eq(projectChats.userId, ctx.userId),
          ),
        )
        .returning({ id: projectChats.id });
      return { success: true, deleted: deleted.length > 0 };
    }),

  rename: protectedProcedure
    .input(
      z.object({
        chatId: z.uuid(),
        title: z.string().trim().min(1).max(255),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Same answer-shape honesty as `delete`: `.returning()` tells a real
      // rename from a miss, and a miss stays a miss so "not yours" and "not
      // there" both answer `renamed: false` instead of leaking existence.
      //
      // `updatedAt` moves with the rename so the renamed chat resurfaces at
      // the top of the getAll ordering — the title is the freshest signal
      // the user has about what the conversation holds.
      const renamed = await db
        .update(projectChats)
        .set({ title: input.title, updatedAt: new Date() })
        .where(
          and(
            eq(projectChats.id, input.chatId),
            eq(projectChats.userId, ctx.userId),
          ),
        )
        .returning({ id: projectChats.id });
      return { success: true, renamed: renamed.length > 0 };
    }),
});
