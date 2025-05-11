import * as z from "zod";

export const repositoryZodSchema = z.object({
  ProjectName: z
    .string()
    .nonempty({ message: "Repository name is required" })
    .min(1, { message: "Repository name must not be empty" })
    .regex(/^[a-zA-Z0-9_.-]+$/, {
      message:
        "Repository name can only contain letters, numbers, underscores, dots, and hyphens",
    }),
  repoUrl: z
    .string()
    .nonempty({ message: "Repository URL is required" })
    .url({ message: "Please enter a valid URL" })
    .includes("github.com", { message: "URL must be a GitHub repository" }),
});
