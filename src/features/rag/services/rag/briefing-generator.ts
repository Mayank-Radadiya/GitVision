/**
 * Repo briefing generator (F-15).
 *
 * Synthesises a plain-language description of a repository into the structured
 * shape stored in `projects.briefing`. Runs once, as the last step of the
 * embedding pipeline, so a repo that has just been imported has something to
 * show on its Overview tab.
 *
 * Design notes
 * ────────────
 * * **Never throws.** A Gemini timeout, a quota error, a malformed response or a
 *   missing project all resolve to `null`. Ingestion must not fail because a
 *   nice-to-have summary could not be written — the Overview card renders an
 *   empty state for `null` and the rest of the product is unaffected.
 * * **Self-contained on purpose.** `context-fetcher.ts` has a near-identical
 *   `fetchProjectOverview`, but it pulls exactly three key files
 *   (README/package.json/tsconfig) and throws when the project is missing. This
 *   one sweeps the full manifest set across ecosystems so a Go or Rust repo gets
 *   a briefing informed by its actual build files, and it degrades to extension
 *   statistics alone when the repo has no manifest at all.
 */

import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { db } from "@/db";
import { projectTables, projectFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/src/lib/logger";
import { PINNED_GEMINI_FLASH } from "@/src/lib/llm/config";
import type { RepoBriefing } from "@/db/schema";

// ─── Schema ──────────────────────────────────────────────────────────────────

/**
 * Mirrors the `RepoBriefing` interface in `db/schema.ts`; `generateObject`
 * needs the runtime schema, the database column only needs the type. The two
 * are asserted to agree by `briefing-generator.test.ts`.
 */
export const repoBriefingSchema = z.object({
  summary: z
    .string()
    .describe(
      "One paragraph, 2-4 sentences, plain language: what this project is and what it does. No marketing adjectives.",
    ),
  description: z
    .string()
    .describe(
      "A single short sentence naming the project and its purpose, suitable as a card subtitle.",
    ),
  techStack: z
    .array(z.string())
    .describe(
      "Framework, runtime and library names detected in the manifests and source files (e.g. 'Next.js', 'Drizzle ORM', 'PostgreSQL'). 3-10 entries, names only.",
    ),
  keyComponents: z
    .array(
      z.object({
        name: z.string().describe("Human-readable name of the part, e.g. 'Ingestion pipeline'."),
        role: z
          .string()
          .describe("One sentence on what this part is responsible for."),
        paths: z
          .array(z.string())
          .describe("Repo-relative file or directory paths that evidence it. Empty if unknown."),
      }),
    )
    .describe("The 3-6 load-bearing parts of the codebase, most important first."),
  architecture: z
    .string()
    .describe(
      "A short paragraph (3-6 sentences) on how the parts fit together: entry points, data flow, external dependencies. Say what you can actually evidence; do not speculate.",
    ),
});

/**
 * Generation settings. Reuse the pinned flash model every other LLM call in the
 * codebase uses, at a cheaper/dumber budget than `chat` (this runs unattended on
 * every import) but a larger output cap than `queryRewrite` because the whole
 * briefing has to fit in one response.
 */
const GENERATION_SETTINGS = {
  maxRetries: 2,
  maxOutputTokens: 2000,
  timeout: { totalMs: 30_000, stepMs: 15_000 },
} as const;

/** Per-file body cap inside the prompt. Generous enough for a README section. */
const MAX_FILE_CHARS = 3000;
/** Hard ceiling on the assembled prompt, so a repo of 500 files cannot blow the window. */
const MAX_PROMPT_CHARS = 24_000;
/** Key files kept before truncation kicks in; overflow still contributes extension stats. */
const MAX_KEY_FILES = 12;

/**
 * Files worth reading in full when present, most informative first. Covers the
 * common ecosystems so the briefing is grounded in the build definition rather
 * than in file extensions alone.
 */
const KEY_FILE_PATTERNS = [
  "README.md",
  "readme.md",
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "requirements.txt",
  "Gemfile",
  "composer.json",
  "pom.xml",
  "build.gradle",
  "tsconfig.json",
  "docker-compose.yml",
  "Dockerfile",
] as const;

// ─── Context gathering ──────────────────────────────────────────────────────

/** Extension → language, for repos whose manifest we could not read. */
const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  mts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  py: "Python",
  rs: "Rust",
  go: "Go",
  rb: "Ruby",
  java: "Java",
  kt: "Kotlin",
  swift: "Swift",
  cs: "C#",
  php: "PHP",
  c: "C",
  h: "C",
  cc: "C++",
  cpp: "C++",
  hpp: "C++",
  vue: "Vue",
  svelte: "Svelte",
  sql: "SQL",
  sh: "Shell",
  ex: "Elixir",
  exs: "Elixir",
  scala: "Scala",
  dart: "Dart",
};

interface BriefingContext {
  /** Repo name, for the prompt's subject line. */
  projectName: string;
  /** Top file extensions, `[{ ext, count }]` descending. */
  topExtensions: { ext: string; count: number }[];
  totalFiles: number;
  /** Contents of key files, truncated. May be empty. */
  keyFiles: { path: string; content: string }[];
  /** Notable top-level paths, for orientation. */
  topLevelPaths: string[];
}

/**
 * Everything the generator needs, gathered defensively: any individual query
 * failing degrades that slice of context rather than the whole briefing.
 */
async function collectContext(projectId: string): Promise<BriefingContext | null> {
  const project = await db.query.projectTables.findFirst({
    where: eq(projectTables.id, projectId),
    columns: { projectName: true },
  });

  if (!project) {
    logger.error(`[Briefing] No project row for ${projectId}; skipping briefing`);
    return null;
  }

  // Every file name, for extension stats and orientation. Same query the
  // existing RAG context fetcher uses; the file count is uncapped upstream too.
  const allFiles = await db
    .select({ fileName: projectFiles.fileName })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId));

  const names = allFiles.map((f) => f.fileName);
  const counts = new Map<string, number>();
  for (const name of names) {
    const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    if (!ext || ext.length > 12) continue; // skip dirnames, lockfiles, long suffixes
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
  const topExtensions = [...counts.entries()]
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const topLevelPaths = [...new Set(names.map((n) => n.split("/")[0]).filter(Boolean))].slice(
    0,
    40,
  );

  // Key file bodies. `inArray` is not an option here because these are
  // substring matches — a manifest may live at `frontend/package.json` — so we
  // read one bounded page and filter the names in memory.
  const keyRows = await db
    .select({ fileName: projectFiles.fileName, code: projectFiles.code })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId))
    .limit(200); // bound the scan before the per-file trim below

  const keyFiles = keyRows
    .filter((row) => matchesKey(row.fileName))
    // Shortest first: a Dockerfile tells us less than a README, and when the
    // budget runs out we want to keep the informative ones.
    .sort((a, b) => a.code.length - b.code.length)
    .slice(0, MAX_KEY_FILES)
    .map((row) => ({ path: row.fileName, content: row.code.slice(0, MAX_FILE_CHARS) }));

  return {
    projectName: project.projectName,
    topExtensions,
    totalFiles: names.length,
    keyFiles,
    topLevelPaths,
  };
}

/**
 * Substring test matching `fetchProjectOverview`'s approach: `api/v1/readme.md`
 * counts as a README. Kept local rather than reusing the RAG fetcher's private
 * helper so the two can diverge without a refactor.
 */
function matchesKey(fileName: string): boolean {
  return KEY_FILE_PATTERNS.some((p) => fileName.includes(p));
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(ctx: BriefingContext): string {
  const languageGuess = ctx.topExtensions
    .map(({ ext, count }) => EXTENSION_LANGUAGES[ext] ?? ext.toUpperCase())
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");

  const sections = [
    `Summarise this software repository for a developer landing on its Overview page.`,
    ``,
    `REPOSITORY: ${ctx.projectName}`,
    `FILE COUNT: ${ctx.totalFiles}`,
    `TOP-LEVEL PATHS: ${ctx.topLevelPaths.join(", ") || "(none recorded)"}`,
    `MOST COMMON FILE TYPES: ${ctx.topExtensions.map((e) => `${e.ext} (${e.count})`).join(", ") || "(none)"}`,
    languageGuess ? `LIKELY LANGUAGE(S): ${languageGuess}` : ``,
    ``,
  ];

  if (ctx.keyFiles.length > 0) {
    sections.push(`KEY FILES:`);
    for (const file of ctx.keyFiles) {
      sections.push(`\n--- ${file.path} ---\n${file.content}`);
    }
  } else {
    sections.push(
      `KEY FILES: none found. Base everything on the file listing and file types above, and say plainly that no README or manifest was available.`,
    );
  }

  sections.push(
    ``,
    `Guidelines:`,
    `- Ground every claim in the evidence above. If the repo has no README, infer only from file structure and manifests, and do not invent a purpose.`,
    `- No superlatives. "Uses Next.js and Drizzle ORM" is useful; "blazing-fast enterprise-grade platform" is not.`,
    `- \`paths\` entries must be paths that appear in the listing above. Empty arrays are better than guesses.`,
    `- If the evidence is too thin for a confident architecture summary, write what you can observe rather than a plausible-sounding fiction.`,
  );

  // Hard cap: a repo full of 12 × 3000-char manifests would otherwise dominate
  // the prompt and push the listing itself out.
  const prompt = sections.join("\n");
  return prompt.length > MAX_PROMPT_CHARS
    ? prompt.slice(0, MAX_PROMPT_CHARS) +
        `\n\n[truncated: ${prompt.length - MAX_PROMPT_CHARS} further characters omitted]`
    : prompt;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Generate and return a briefing for `projectId`, or `null` for any reason
 * there isn't one. The caller persists it; this function never writes to the
 * database itself, so the Inngest step owns the write and stays idempotent.
 */
export async function generateRepoBriefing(
  projectId: string,
): Promise<RepoBriefing | null> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      // Matches `src/lib/gemini.ts`, which throws at import time. Here we skip
      // instead: a missing key in one environment must not take out ingestion.
      logger.error("[Briefing] GEMINI_API_KEY is missing; skipping briefing");
      return null;
    }

    const ctx = await collectContext(projectId);

    // A project with no indexed files has nothing to describe. Returning null
    // lets the card say "not generated" rather than showing an LLM's guess at
    // an empty repo.
    if (!ctx || ctx.totalFiles === 0) {
      logger.warn(`[Briefing] No files to summarise for ${projectId}; skipping`);
      return null;
    }

    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
    const { object } = await generateObject({
      model: google(PINNED_GEMINI_FLASH),
      schema: repoBriefingSchema,
      ...GENERATION_SETTINGS,
      prompt: buildPrompt(ctx),
    });

    return object as RepoBriefing;
  } catch (error: unknown) {
    // Deliberately swallowed. Ingestion continues; the card shows its empty
    // state. Matches the "must not fail the whole ingestion" rule in the task.
    const err = error as { status?: number; message?: string };
    if (err?.status === 429) logger.error("[Briefing] Gemini quota exceeded");
    else if (err?.status === 404) logger.error("[Briefing] Gemini model not found");
    else logger.error(`[Briefing] Generation failed for ${projectId}`, error);
    return null;
  }
}