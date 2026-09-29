/**
 * Context Fetcher - Retrieves appropriate code context based on query intent
 */

import { Octokit } from "octokit";
import { db } from "@/db";
import { projectTables, projectFiles } from "@/db/schema";
import { eq, like, or, and } from "drizzle-orm";
import type { ClassifiedQuery } from "./query-classifier";
import { estimateTokens, fitToBudget } from "@/src/lib/llm/budget";
import { logger } from "@/src/lib/logger";

// Initialize Octokit
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export interface FileContent {
  path: string;
  content: string;
  summary?: string;
}

export interface CodeContext {
  type: "file" | "folder" | "dependency" | "overview";
  files: FileContent[];
  metadata: {
    totalFiles: number;
    folders?: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dependencies?: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stats?: any;
  };
}

/**
 * Main function to fetch context based on classified query
 */
export async function fetchContext(
  projectId: string,
  classifiedQuery: ClassifiedQuery,
): Promise<CodeContext> {
  switch (classifiedQuery.intent) {
    case "file-specific":
      return await fetchFileContext(projectId, classifiedQuery.targets);

    case "folder-based":
      return await fetchFolderContext(projectId, classifiedQuery.targets);

    case "dependency-analysis":
      return await fetchDependencyContext(projectId);

    case "project-overview":
      return await fetchProjectOverview(projectId);

    case "general-question":
    default:
      // Will be handled by vector search in RAG API
      return {
        type: "file",
        files: [],
        metadata: { totalFiles: 0 },
      };
  }
}

/**
 * Fetch specific files by name
 */
async function fetchFileContext(
  projectId: string,
  fileNames: string[],
): Promise<CodeContext> {
  // One query for every target. A per-target query gave each of N targets its
  // own 5-file budget, so asking about 4 filenames pulled 20 files into the
  // prompt. `limit` is the whole answer's budget, not a per-target allowance.
  const results = await db
    .select({
      fileName: projectFiles.fileName,
      code: projectFiles.code,
    })
    .from(projectFiles)
    .where(
      and(
        eq(projectFiles.projectId, projectId),
        or(...fileNames.map((fileName) => like(projectFiles.fileName, `%${fileName}%`))),
      ),
    )
    .limit(5);

  const files: FileContent[] = results.map((r) => ({
    path: r.fileName,
    content: r.code,
  }));

  return {
    type: "file",
    files,
    metadata: {
      totalFiles: files.length,
    },
  };
}

/**
 * Fetch files from specific folders
 */
async function fetchFolderContext(
  projectId: string,
  folderPatterns: string[],
): Promise<CodeContext> {
  const folders = new Set<string>();

  // Build OR condition for multiple folder patterns
  const conditions = folderPatterns.map((pattern) =>
    like(projectFiles.fileName, `%${pattern}%`),
  );

  const results = await db
    .select({
      fileName: projectFiles.fileName,
      code: projectFiles.code,
    })
    .from(projectFiles)
    .where(and(eq(projectFiles.projectId, projectId), or(...conditions)))
    .limit(15); // Limit to avoid token overflow

  // Extract unique folders
  results.forEach((r) => {
    const parts = r.fileName.split("/");
    if (parts.length > 1) {
      folders.add(parts[0]);
    }
  });

  // Full content for the 15 we kept. This used to hand back 30 rows, and above
  // 15 swap every body for a `File: x (N lines)` summary — which is strictly
  // worse to answer from than 15 real files, and now unreachable anyway.
  return {
    type: "folder",
    files: results.map((r) => ({
      path: r.fileName,
      content: r.code,
    })),
    metadata: {
      totalFiles: results.length,
      folders: Array.from(folders),
    },
  };
}

/**
 * Fetch and analyze dependencies
 */
async function fetchDependencyContext(projectId: string): Promise<CodeContext> {
  // Get project details
  const project = await db.query.projectTables.findFirst({
    where: eq(projectTables.id, projectId),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Parse GitHub URL
  const urlParts = project.githubUrl.split("/");
  const owner = urlParts[urlParts.length - 2];
  const repo = urlParts[urlParts.length - 1].replace(".git", "");

  try {
    // Fetch package.json from GitHub
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "package.json",
    });

    if ("content" in data) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      const packageJson = JSON.parse(content);

      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Categorize dependencies
      const categorized = categorizeDependencies(dependencies);

      return {
        type: "dependency",
        files: [
          {
            path: "package.json",
            content: JSON.stringify(categorized, null, 2),
          },
        ],
        metadata: {
          totalFiles: 1,
          dependencies: categorized,
        },
      };
    }
  } catch (error) {
    logger.error("Error fetching package.json", error);
  }

  return {
    type: "dependency",
    files: [],
    metadata: {
      totalFiles: 0,
      dependencies: {},
    },
  };
}

/**
 * Generate project overview
 */
async function fetchProjectOverview(projectId: string): Promise<CodeContext> {
  // Get project stats
  const project = await db.query.projectTables.findFirst({
    where: eq(projectTables.id, projectId),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Get file count by type
  const allFiles = await db
    .select({
      fileName: projectFiles.fileName,
    })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId));

  const fileTypes = countFileTypes(allFiles.map((f) => f.fileName));
  const folders = extractFolderStructure(allFiles.map((f) => f.fileName));

  // Try to fetch key files
  const keyFileNames = ["README.md", "package.json", "tsconfig.json"];
  const keyFiles: FileContent[] = [];

  for (const fileName of keyFileNames) {
    const file = await db.query.projectFiles.findFirst({
      where: and(
        eq(projectFiles.projectId, projectId),
        like(projectFiles.fileName, `%${fileName}%`),
      ),
    });

    if (file) {
      keyFiles.push({
        path: file.fileName,
        content: file.code,
      });
    }
  }

  return {
    type: "overview",
    files: keyFiles,
    metadata: {
      totalFiles: allFiles.length,
      folders,
      stats: {
        stars: project.star,
        forks: project.forks,
        commits: project.totalCommits,
        contributors: project.totalContributors,
        fileTypes,
      },
    },
  };
}

/**
 * Categorize dependencies by type
 */
function categorizeDependencies(deps: Record<string, string>) {
  const categories = {
    frameworks: {} as Record<string, string>,
    ui: {} as Record<string, string>,
    database: {} as Record<string, string>,
    testing: {} as Record<string, string>,
    tooling: {} as Record<string, string>,
    other: {} as Record<string, string>,
  };

  const frameworkKeys = [
    "next",
    "react",
    "vue",
    "svelte",
    "angular",
    "express",
    "nest",
  ];
  const uiKeys = [
    "tailwind",
    "styled",
    "emotion",
    "mui",
    "@mui",
    "chakra",
    "mantine",
  ];
  const dbKeys = [
    "prisma",
    "drizzle",
    "pg",
    "mongodb",
    "mysql",
    "sqlite",
    "typeorm",
  ];
  const testKeys = [
    "jest",
    "vitest",
    "playwright",
    "cypress",
    "@testing-library",
    "mocha",
  ];
  const toolKeys = [
    "typescript",
    "eslint",
    "prettier",
    "webpack",
    "vite",
    "turbo",
  ];

  for (const [name, version] of Object.entries(deps)) {
    const lowerName = name.toLowerCase();

    if (frameworkKeys.some((k) => lowerName.includes(k))) {
      categories.frameworks[name] = version;
    } else if (uiKeys.some((k) => lowerName.includes(k))) {
      categories.ui[name] = version;
    } else if (dbKeys.some((k) => lowerName.includes(k))) {
      categories.database[name] = version;
    } else if (testKeys.some((k) => lowerName.includes(k))) {
      categories.testing[name] = version;
    } else if (toolKeys.some((k) => lowerName.includes(k))) {
      categories.tooling[name] = version;
    } else {
      categories.other[name] = version;
    }
  }

  return categories;
}

/**
 * Count files by extension
 */
function countFileTypes(filePaths: string[]): Record<string, number> {
  const types: Record<string, number> = {};

  filePaths.forEach((path) => {
    const ext = path.split(".").pop() || "unknown";
    types[ext] = (types[ext] || 0) + 1;
  });

  return types;
}

/**
 * Extract folder structure
 */
function extractFolderStructure(filePaths: string[]): string[] {
  const folders = new Set<string>();

  filePaths.forEach((path) => {
    const parts = path.split("/");
    if (parts.length > 1) {
      folders.add(parts[0]);
    }
  });

  return Array.from(folders).sort();
}

// ---------------------------------------------------------------------------
// CodeContext → prompt string
// ---------------------------------------------------------------------------

/**
 * Format a CodeContext (from the intent-based fetcher) into the string
 * injected into the system prompt.
 *
 * Lives beside the type it consumes so the budget it enforces is testable
 * without booting a route handler.
 */
export function formatCodeContext(
  ctx: CodeContext,
  maxTokens?: number,
): string {
  if (ctx.files.length === 0) return "";

  if (ctx.type === "dependency") {
    return `DEPENDENCY ANALYSIS:\n${JSON.stringify(ctx.metadata.dependencies, null, 2)}`;
  }

  if (ctx.type === "overview") {
    const stats = ctx.metadata.stats ?? {};
    const fileTypes = stats.fileTypes
      ? Object.entries(stats.fileTypes as Record<string, number>)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([ext, count]) => `  .${ext}: ${count} files`)
          .join("\n")
      : "";

    const keyFiles = ctx.files
      .map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 3000)}\n\`\`\``)
      .join("\n\n");

    return `PROJECT OVERVIEW:
- Total files: ${ctx.metadata.totalFiles}
- Stars: ${stats.stars ?? "?"} | Forks: ${stats.forks ?? "?"} | Commits: ${stats.commits ?? "?"}
- Folders: ${(ctx.metadata.folders ?? []).join(", ")}

FILE TYPE BREAKDOWN:
${fileTypes}

KEY FILES:
${keyFiles}`;
  }

  // file | folder
  const parts = ctx.files.map((f) => {
    if (f.summary && !f.content) {
      return `File: ${f.path}\n${f.summary}`;
    }
    return `\`\`\`\n// File: ${f.path}\n${f.content}\n\`\`\``;
  });

  // Whole-file bodies are unbounded — a folder match can easily be hundreds of
  // kB. Trim to the caller's context allowance instead of hoping the provider
  // swallows the overflow. fitToBudget cuts on file boundaries, so a prompt
  // never ends mid-fence.
  if (maxTokens === undefined || maxTokens <= 0) return parts.join("\n\n");

  const { included } = fitToBudget(
    parts.map((text) => ({ text, approxTokens: estimateTokens(text) })),
    maxTokens,
  );

  return included.map((item) => item.text).join("\n\n");
}
