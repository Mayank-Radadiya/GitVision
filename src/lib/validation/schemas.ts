import { z } from "zod";
import { extractMessageText } from "@/src/shared/lib/message-extractor";

/**
 * Primitive validators for common data types
 */
export const validators = {
  uuid: z.string().uuid("Invalid UUID format"),

  email: z.string().email("Invalid email format"),

  url: z.string().url("Invalid URL format"),

  /**
   * GitHub repository URL validator
   * Accepts: https://github.com/owner/repo or https://github.com/owner/repo.git
   */
  githubUrl: z
    .string()
    .url("Invalid URL format")
    .regex(
      /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(\.git)?$/,
      "Invalid GitHub URL. Expected format: https://github.com/owner/repo",
    ),

  /**
   * Safe string without HTML/XSS
   */
  safeString: z
    .string()
    .max(1000, "String too long")
    .regex(/^[^<>]*$/, "HTML tags not allowed"),
};

/**
 * Pagination schema with cursor-based pagination support
 */
export const paginationSchema = z.object({
  limit: z
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(20),
  cursor: z.string().uuid("Invalid cursor").optional(),
});

/**
 * Project creation schema
 */
export const projectCreateSchema = z.object({
  projectName: z
    .string()
    .min(1, "Project name is required")
    .max(255, "Project name too long")
    .regex(/^[^<>]*$/, "Invalid characters in project name"),
  repoUrl: validators.githubUrl,
});

/**
 * Project ID schema for queries
 */
export const projectIdSchema = z.object({
  projectId: validators.uuid,
});

/**
 * Project commits query schema (with pagination)
 */
export const projectCommitsSchema = projectIdSchema.extend({
  limit: paginationSchema.shape.limit,
  cursor: paginationSchema.shape.cursor,
});

/**
 * AI summary generation input
 */
export const generateAiSummarySchema = z.object({
  projectId: validators.uuid,
  commitId: validators.uuid,
});

/**
 * Ceilings for a single chat request.
 *
 * The body is entirely client-controlled, so without these a caller could post
 * an arbitrarily long message list and have it forwarded to the model — an
 * unbounded cost and prompt-injection surface. The caps sit well above a real
 * conversation (a long chat is tens of thousands of characters, not hundreds of
 * thousands) while still bounding the worst case.
 */
export const MAX_CHAT_MESSAGES = 100;
export const MAX_CHAT_MESSAGE_CHARS = 20_000;
export const MAX_CHAT_INPUT_CHARS = 400_000;

/**
 * A single incoming message.
 *
 * Deliberately loose on shape: the AI SDK v5 sends `parts` while older clients
 * send `content`, and `extractMessageText` already handles both. The size caps
 * are applied in `chatRequestSchema`'s refinement, where the text can actually
 * be read.
 */
const chatMessageSchema = z
  .object({
    role: z.string().max(20).optional(),
  })
  .passthrough();

/**
 * POST /api/chat body.
 *
 * A malformed `chatId` or `projectId` used to reach the ownership query and
 * surface as a 500 from Postgres, instead of the 400 it is.
 */
export const chatRequestSchema = z
  .object({
    messages: z
      .array(chatMessageSchema)
      .min(1, "At least one message is required")
      .max(MAX_CHAT_MESSAGES, "Too many messages"),
    chatId: z.string().uuid("Invalid chat id").optional(),
    projectId: validators.uuid.optional(),
    mode: z.enum(["general", "project"]).default("general"),
  })
  .superRefine((value, ctx) => {
    let total = 0;
    for (const [index, message] of value.messages.entries()) {
      const text = extractMessageText(message);
      if (text.length > MAX_CHAT_MESSAGE_CHARS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages", index],
          message: `Message ${index + 1} is too long`,
        });
        return;
      }
      total += text.length;
    }
    if (total > MAX_CHAT_INPUT_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messages"],
        message: "Conversation is too long",
      });
    }
  });
