/**
 * Golden dataset for the retrieval eval harness (task F-18).
 *
 * Each case is a natural-language question whose single best answer is one file
 * in one public demo repo. Expectations are repo-relative paths because
 * `rag-ingestion` writes `codeEmbeddings.filePath` verbatim from
 * `projectFiles.fileName` — no basename or normalization happens anywhere.
 *
 * Repos were picked for a stable, non-trivial file tree: `expressjs/express`
 * (JS), `sindresorhus/ky` (TS), `sindresorhus/got` (TS). `octocat/Hello-World`
 * is deliberately absent — it is the e2e fixture and holds a single `README`,
 * so it cannot measure retrieval.
 *
 * This module is intentionally free of `@/db` and any other import with
 * module-load side effects: the vitest unit test for the metric math imports
 * it directly, and `db/index.ts` evaluates `DATABASE_URL` at import time.
 */

export interface EvalCase {
  /** Stable id, used in the per-query report table. */
  id: string;
  /** `owner/repo` slug, matched against `projects.githubUrl`. */
  repo: string;
  question: string;
  /** The one file whose chunks should carry this answer. */
  expectedFile: string;
}

export const EVAL_REPOS = [
  "expressjs/express",
  "sindresorhus/ky",
  "sindresorhus/got",
] as const;

export const EVAL_DATASET: EvalCase[] = [
  // ---------------------------------------------------------------- express
  {
    id: "express-01",
    repo: "expressjs/express",
    question:
      "How do I create the application object and set its view engine, views directory, and view cache options?",
    expectedFile: "lib/express.js",
  },
  {
    id: "express-02",
    repo: "expressjs/express",
    question:
      "Where is the app prototype that defines use(), handle(), listen() and the router dispatch?",
    expectedFile: "lib/application.js",
  },
  {
    id: "express-03",
    repo: "expressjs/express",
    question:
      "How do I set the HTTP status code and response headers such as Content-Type on the response object?",
    expectedFile: "lib/response.js",
  },
  {
    id: "express-04",
    repo: "expressjs/express",
    question:
      "How are the request's query string parameters, body and cookies exposed as properties on the request object?",
    expectedFile: "lib/request.js",
  },
  {
    id: "express-05",
    repo: "expressjs/express",
    question:
      "How does a view get rendered, looking up the engine and merging the view locals and options before sending?",
    expectedFile: "lib/view.js",
  },
  {
    id: "express-06",
    repo: "expressjs/express",
    question:
      "Which file holds the express core helpers for escaping HTML, setting the charset, and varying the response header?",
    expectedFile: "lib/utils.js",
  },
  {
    id: "express-07",
    repo: "expressjs/express",
    question:
      "What does the top level express package entry point export, and how is the application created from it?",
    expectedFile: "index.js",
  },
  {
    id: "express-08",
    repo: "expressjs/express",
    question:
      "How do I mount the version 1 API router in the multi-router example using express.Router?",
    expectedFile: "examples/multi-router/controllers/api_v1.js",
  },
  {
    id: "express-09",
    repo: "expressjs/express",
    question: "How does the MVC example open its sqlite database connection?",
    expectedFile: "examples/mvc/db.js",
  },
  {
    id: "express-10",
    repo: "expressjs/express",
    question:
      "How is the post resource given its own router in the route-separation example?",
    expectedFile: "examples/route-separation/post.js",
  },

  // --------------------------------------------------------------------- ky
  {
    id: "ky-01",
    repo: "sindresorhus/ky",
    question:
      "How do I import ky and call it to perform a GET request with a single function call?",
    expectedFile: "source/index.ts",
  },
  {
    id: "ky-02",
    repo: "sindresorhus/ky",
    question:
      "What class holds the ky instance state, constructor defaults and the request lifecycle methods?",
    expectedFile: "source/core/Ky.ts",
  },
  {
    id: "ky-03",
    repo: "sindresorhus/ky",
    question:
      "Where are the default ky option values such as the timeout, retry limit and backoff defined?",
    expectedFile: "source/core/constants.ts",
  },
  {
    id: "ky-04",
    repo: "sindresorhus/ky",
    question: "How does ky compute the delay in milliseconds between retry attempts?",
    expectedFile: "source/core/retry-timing.ts",
  },
  {
    id: "ky-05",
    repo: "sindresorhus/ky",
    question:
      "Which error class is thrown when ky is configured to throw on a non-2xx HTTP response status?",
    expectedFile: "source/errors/HTTPError.ts",
  },
  {
    id: "ky-06",
    repo: "sindresorhus/ky",
    question:
      "What error does ky raise when the request exceeds the configured timeout?",
    expectedFile: "source/errors/TimeoutError.ts",
  },
  {
    id: "ky-07",
    repo: "sindresorhus/ky",
    question:
      "Which error is thrown for network level failures such as DNS lookup or connection refused?",
    expectedFile: "source/errors/NetworkError.ts",
  },
  {
    id: "ky-08",
    repo: "sindresorhus/ky",
    question:
      "How can a beforeRequest hook throw to make ky retry the request even though the response was successful?",
    expectedFile: "source/errors/ForceRetryError.ts",
  },
  {
    id: "ky-09",
    repo: "sindresorhus/ky",
    question:
      "What error is raised when the response body fails to validate against the supplied schema?",
    expectedFile: "source/errors/SchemaValidationError.ts",
  },
  {
    id: "ky-10",
    repo: "sindresorhus/ky",
    question:
      "Which class is the base error that every other ky specific error extends?",
    expectedFile: "source/errors/KyError.ts",
  },

  // -------------------------------------------------------------------- got
  {
    id: "got-01",
    repo: "sindresorhus/got",
    question:
      "How do I import got and call it directly to issue an HTTP request?",
    expectedFile: "source/index.ts",
  },
  {
    id: "got-02",
    repo: "sindresorhus/got",
    question: "How do I create a reusable got instance that carries default options?",
    expectedFile: "source/create.ts",
  },
  {
    id: "got-03",
    repo: "sindresorhus/got",
    question:
      "What is the main got request function that normalizes the arguments and returns a request stream?",
    expectedFile: "source/core/index.ts",
  },
  {
    id: "got-04",
    repo: "sindresorhus/got",
    question:
      "Where are got's default option values such as method, timeout, retry limit and throwHttpErrors defined?",
    expectedFile: "source/core/options.ts",
  },
  {
    id: "got-05",
    repo: "sindresorhus/got",
    question:
      "How is the got response object assembled with the body, statusCode, headers and timing information?",
    expectedFile: "source/core/response.ts",
  },
  {
    id: "got-06",
    repo: "sindresorhus/got",
    question: "Where are the got HTTPError and RequestError classes defined and raised?",
    expectedFile: "source/core/errors.ts",
  },
  {
    id: "got-07",
    repo: "sindresorhus/got",
    question:
      "How does got decide which timeout event fired and how long the request had been running?",
    expectedFile: "source/core/timed-out.ts",
  },
  {
    id: "got-08",
    repo: "sindresorhus/got",
    question: "How does got calculate the backoff delay before the next retry?",
    expectedFile: "source/core/calculate-retry-delay.ts",
  },
  {
    id: "got-09",
    repo: "sindresorhus/got",
    question: "How does got parse the Link response header to support following pagination URLs?",
    expectedFile: "source/core/parse-link-header.ts",
  },
  {
    id: "got-10",
    repo: "sindresorhus/got",
    question:
      "How does the as-promise API wrap a got request stream so it can be awaited directly?",
    expectedFile: "source/as-promise/index.ts",
  },
];

// ----------------------------------------------------------------- metrics

/**
 * Did the expected file land inside the top-`k` retrieved chunks?
 *
 * Recall@k is scored per *chunk*, which is what `searchSimilarCode` actually
 * returns, so a file that produces five top-10 chunks is as much of a hit as
 * one that produces a single chunk. With a single golden file per question the
 * hit rate and recall are the same number by construction.
 */
export function hitAtK(
  rankedFilePaths: readonly string[],
  expectedFile: string,
  k: number
): boolean {
  if (k <= 0) return false;
  return rankedFilePaths.slice(0, k).includes(expectedFile);
}

/** Mean of per-case 0/1 outcomes. An empty case list scores 0, not NaN. */
export function macroAverage(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
