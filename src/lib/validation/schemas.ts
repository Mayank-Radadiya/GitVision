import { z } from "zod";

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
