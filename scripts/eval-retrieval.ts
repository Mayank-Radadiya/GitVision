/**
 * Retrieval eval harness (task F-18).
 *
 * Runs the golden dataset in `scripts/data/retrieval-eval-dataset.ts` through
 * the same vector path the chat route uses, then reports recall@k.
 *
 * Run: npx tsx scripts/eval-retrieval.ts
 *      npx tsx scripts/eval-retrieval.ts --with-citations   (adds the answer-citation row)
 *
 * Retrieval numbers are collected unconditionally. The citation pass calls the
 * chat LLM once per query, so it is opt-in: without `--with-citations`, or
 * without GEMINI_API_KEY, that column prints `n/a` and the run still succeeds.
 *
 * Config note: production `retrieveContext` (app/api/chat/route.ts) fetches a
 * raw candidate pool of 12 and reranks down to 8, which makes recall@10
 * unreachable. This harness widens both (RAW_LIMIT / RERANK_LIMIT below) so
 * k=3/5/10 are all measurable, and prints both configurations in the report
 * header so the two are never confused. Treat R@3 and R@5 as the numbers that
 * transfer to production; R@10 is an upper bound.
 */

import dotenv from "dotenv";
import { EVAL_DATASET, EVAL_REPOS, hitAtK, macroAverage } from "./data/retrieval-eval-dataset";
import type { EvalCase } from "./data/retrieval-eval-dataset";
// Type-only, so it is erased at compile time and adds no runtime import.
import type { SearchResult } from "@/features/rag/services/vector-search";

dotenv.config();

/** Production uses (12, 8); recall@10 needs a wider pool and a deeper rerank. */
const RAW_LIMIT = 20;
const RERANK_LIMIT = 10;
const PRODUCTION_RAW_LIMIT = 12;
const PRODUCTION_RERANK_LIMIT = 8;
/** Matches app/api/chat/route.ts — below this the HNSW index cannot be used. */
const MIN_SIMILARITY = 0.45;
const RECALL_KS = [3, 5, 10] as const;

const wantCitations = process.argv.includes("--with-citations");

type Hits = Record<(typeof RECALL_KS)[number], boolean>;

interface CaseOutcome {
  testCase: EvalCase;
  ranked: SearchResult[];
  hits: Hits;
  error?: string;
}

const NO_HITS: Hits = { 3: false, 5: false, 10: false };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not defined in environment variables.`);
    console.error("Copy .env.example to .env and fill it in, then re-run.");
    process.exit(1);
  }
  return value;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function mdRow(cells: (string | number)[]): string {
  return `| ${cells.join(" | ")} |`;
}

function scoreFor(outcomes: readonly CaseOutcome[], k: (typeof RECALL_KS)[number]) {
  return macroAverage(outcomes.map((o) => (o.hits[k] ? 1 : 0)));
}

async function main(): Promise<void> {
  requireEnv("DATABASE_URL");
  requireEnv("OPENROUTER_API_KEY");

  // Imported dynamically on purpose: `@/db` calls `neon(process.env.DATABASE_URL)`
  // at module load, so a static import would throw before the guards above run.
  const { db } = await import("@/db");
  const { projectTables } = await import("@/db/schema");
  const { like } = await import("drizzle-orm");
  const { searchSimilarCode, reRankResults } = await import(
    "@/features/rag/services/vector-search"
  );
  const { generateQueryEmbedding } = await import(
    "@/features/rag/services/embeddings"
  );

  // Resolve `owner/repo` to the project row the embeddings hang off. A repo
  // that was never indexed is reported rather than thrown, so a partial
  // bootstrap still yields a table instead of a stack trace.
  const projectIds = new Map<string, string | null>();
  for (const repo of EVAL_REPOS) {
    const [owner, name] = repo.split("/");
    const match = await db
      .select({ id: projectTables.id })
      .from(projectTables)
      .where(like(projectTables.githubUrl, `%${owner}/${name}%`))
      .limit(1);
    projectIds.set(repo, match[0]?.id ?? null);
  }

  const outcomes: CaseOutcome[] = [];

  for (const repo of EVAL_REPOS) {
    const projectId = projectIds.get(repo) ?? null;

    if (!projectId) {
      console.error(`SKIPPED ${repo} — no indexed project matches this githubUrl.`);
      for (const testCase of EVAL_DATASET.filter((c) => c.repo === repo)) {
        outcomes.push({ testCase, ranked: [], hits: NO_HITS, error: "no indexed project" });
      }
      continue;
    }

    for (const testCase of EVAL_DATASET.filter((c) => c.repo === repo)) {
      try {
        const embedding = await generateQueryEmbedding(testCase.question);
        const raw = await searchSimilarCode(
          projectId,
          embedding,
          testCase.question,
          RAW_LIMIT,
          MIN_SIMILARITY
        );
        const ranked = reRankResults(raw, testCase.question, RERANK_LIMIT);
        const paths = ranked.map((r) => r.filePath);
        outcomes.push({
          testCase,
          ranked,
          hits: {
            3: hitAtK(paths, testCase.expectedFile, 3),
            5: hitAtK(paths, testCase.expectedFile, 5),
            10: hitAtK(paths, testCase.expectedFile, 10),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outcomes.push({ testCase, ranked: [], hits: NO_HITS, error: message });
      }
    }
  }

  const citation = await scoreCitations(outcomes);
  printReport(outcomes, citation);
}

/**
 * Ask the chat model the dataset question with the retrieved context and check
 * whether the answer cites the expected file path. The chat prompt asks for
 * file references but enforces no citation format, so this is a literal
 * substring match, not a semantic one.
 */
async function scoreCitations(
  outcomes: readonly CaseOutcome[]
): Promise<{ rate: number | null; note: string }> {
  if (!wantCitations) {
    return { rate: null, note: "pass --with-citations to measure" };
  }
  if (!process.env.GEMINI_API_KEY) {
    return { rate: null, note: "GEMINI_API_KEY is not set" };
  }

  const answerable = outcomes.filter((o) => !o.error && o.ranked.length > 0);
  if (answerable.length === 0) {
    return { rate: null, note: "no query retrieved any chunk" };
  }

  const { generateText } = await import("ai");
  const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
  const { LLM_SETTINGS } = await import("@/src/lib/llm/config");
  const { formatRetrievedContext } = await import(
    "@/features/rag/services/vector-search"
  );

  const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
  const hits: number[] = [];

  for (const outcome of answerable) {
    const { text } = await generateText({
      model: google(LLM_SETTINGS.chat.model),
      maxRetries: LLM_SETTINGS.chat.maxRetries,
      maxOutputTokens: LLM_SETTINGS.chat.maxOutputTokens,
      timeout: LLM_SETTINGS.chat.timeout,
      system:
        "You answer questions about a codebase using only the provided code chunks. " +
        "Reference the specific file paths from the chunks when relevant.",
      prompt: `${formatRetrievedContext(outcome.ranked)}\n\n---\n\nQuestion: ${outcome.testCase.question}`,
    });
    hits.push(text.includes(outcome.testCase.expectedFile) ? 1 : 0);
  }

  return { rate: macroAverage(hits), note: `measured over ${hits.length} answers` };
}

function printReport(
  outcomes: readonly CaseOutcome[],
  citation: { rate: number | null; note: string }
): void {
  const lines = [
    "# Retrieval eval",
    "",
    `prod: raw ${PRODUCTION_RAW_LIMIT} / rerank ${PRODUCTION_RERANK_LIMIT} · ` +
      `harness: raw ${RAW_LIMIT} / rerank ${RERANK_LIMIT} · minSimilarity ${MIN_SIMILARITY}`,
    "",
    mdRow(["repo", "n", ...RECALL_KS.map((k) => `R@${k}`)]),
    mdRow(["---", "---", ...RECALL_KS.map(() => "---")]),
  ];

  for (const repo of EVAL_REPOS) {
    const rows = outcomes.filter((o) => o.testCase.repo === repo);
    lines.push(
      mdRow([repo, rows.length, ...RECALL_KS.map((k) => pct(scoreFor(rows, k)))])
    );
  }

  lines.push(
    mdRow(["**overall**", outcomes.length, ...RECALL_KS.map((k) => pct(scoreFor(outcomes, k)))])
  );
  lines.push("");
  lines.push(
    `Answer-contains-citation: ${citation.rate === null ? "n/a" : pct(citation.rate)} (${citation.note})`
  );

  lines.push("");
  lines.push("## Per query");
  lines.push("");
  lines.push(mdRow(["id", "repo", "expected", "R@3", "R@5", "R@10", "top-3 retrieved"]));
  lines.push(mdRow(["---", "---", "---", "---", "---", "---", "---"]));
  for (const outcome of outcomes) {
    const mark = (hit: boolean) => (hit ? "x" : "-");
    lines.push(
      mdRow([
        outcome.testCase.id,
        outcome.testCase.repo,
        `\`${outcome.testCase.expectedFile}\``,
        mark(outcome.hits[3]),
        mark(outcome.hits[5]),
        mark(outcome.hits[10]),
        outcome.error
          ? `error: ${outcome.error}`
          : outcome.ranked
              .slice(0, 3)
              .map((r) => `\`${r.filePath}\``)
              .join(", ") || "-",
      ])
    );
  }

  console.log(lines.join("\n"));
}

main().catch((error: unknown) => {
  console.error("eval-retrieval failed:", error);
  process.exit(1);
});
