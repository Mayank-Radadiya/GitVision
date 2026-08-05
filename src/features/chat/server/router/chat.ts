import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
} from "../../../../lib/trpc/init";
import { db } from "@/db";
import { projectChats, chatMessages } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { assertProjectOwnership } from "@/src/lib/guards";

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
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const type = input?.type ?? "all";
      const conditions = [eq(projectChats.userId, ctx.userId)];

      if (type === "project") {
        conditions.push(eq(projectChats.type, "project"));
      } else if (type === "general") {
        conditions.push(eq(projectChats.type, "general"));
      }

      return db
        .select()
        .from(projectChats)
        .where(and(...conditions))
        .orderBy(desc(projectChats.updatedAt));
    }),

  getById: protectedProcedure
    .input(z.object({ chatId: z.string().uuid() }))
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

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, input.chatId))
        .orderBy(chatMessages.createdAt);

      return { ...chat, messages };
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

  updateTitle: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        title: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db
        .update(projectChats)
        .set({ title: input.title, updatedAt: new Date() })
        .where(
          and(
            eq(projectChats.id, input.chatId),
            eq(projectChats.userId, ctx.userId),
          ),
        );
      return { success: true };
    }),

  getByProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return db
        .select()
        .from(projectChats)
        .where(
          and(
            eq(projectChats.userId, ctx.userId),
            eq(projectChats.projectId, input.projectId),
          ),
        )
        .orderBy(desc(projectChats.updatedAt));
    }),
});
