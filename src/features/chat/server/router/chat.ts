import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../../../../lib/trpc/init";
import { db } from "@/db";
import { projectChats, chatMessages } from "@/db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import { assertProjectOwnership } from "@/src/lib/guards";

const DEFAULT_CHAT_LIMIT = 30;
const MAX_CHAT_LIMIT = 100;
const DEFAULT_MESSAGE_LIMIT = 100;
const MAX_MESSAGE_LIMIT = 300;

export const chatRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(["project", "general"]),
        projectId: z.string().uuid().optional(),
        title: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.type === "project" && !input.projectId) {
        throw new Error("Project ID required for project chats");
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
        chatId: z.string().uuid(),
        messageLimit: z
          .number()
          .int()
          .min(1)
          .max(MAX_MESSAGE_LIMIT)
          .default(DEFAULT_MESSAGE_LIMIT),
      }),
    )
    .query(async ({ input, ctx }) => {
      const [chat] = await db
        .select()
        .from(projectChats)
        .where(
          and(
            eq(projectChats.id, input.chatId),
            eq(projectChats.userId, ctx.userId),
          ),
        )
        .limit(1);

      if (!chat) throw new Error("Chat not found");

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

      return { ...chat, messages: messages.reverse(), hasMoreMessages };
    }),

  delete: protectedProcedure
    .input(z.object({ chatId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(projectChats)
        .where(
          and(
            eq(projectChats.id, input.chatId),
            eq(projectChats.userId, ctx.userId),
          ),
        );
      return { success: true };
    }),
});
