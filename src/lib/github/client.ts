// ============================================================================
// GitHub Module — Octokit Instance & HTTP Utilities
// ============================================================================
// Handles the actual connection to the outside world.
// Nothing else in the module should create Octokit instances.

import { Octokit } from "octokit";
import axios, { AxiosRequestConfig } from "axios";
import { GITHUB_CONFIG, RETRYABLE_STATUS_CODES } from "./constants";
import { logger } from "@/src/lib/logger";
import {
  GitHubAPIError,
  GitHubRateLimitError,
  GitHubNotFoundError,
} from "./errors";

// ── Authenticated Octokit singleton ──
// Built on first use, never at module load. `src/lib/github/index.ts` is
// imported by the project router and by `_app.ts`, so a module-load throw
// here took down every tRPC call — chat included, which never touches
// GitHub — and could break `next build`. The token is still required, it is
// just required where it is used.

let octokit: Octokit | null = null;

export function getOctokit(): Octokit {
  if (!octokit) {
    const auth = process.env.GITHUB_TOKEN;
    if (!auth) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }
    octokit = new Octokit({ auth });
  }
  return octokit;
}

export function getGitHubAuthHeader(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Streams a repository tarball straight from the GitHub API.
 * Octokit cannot hand back a response body as a stream, so this stays the one
 * sanctioned place services/ may reach GitHub over HTTP — see the
 * `no-restricted-imports` rule in eslint.config.mjs.
 */
export async function fetchRepoTarballStream(owner: string, repo: string) {
  return axios({
    method: "get",
    url: `https://api.github.com/repos/${owner}/${repo}/tarball`,
    responseType: "stream",
    headers: {
      ...getGitHubAuthHeader(),
      Accept: "application/vnd.github.v3+json",
    },
    timeout: 120000, // 2-minute timeout for large repos
  });
}

/**
 * HTTP GET with automatic retries and exponential backoff.
 * Retries on 404 (GitHub CDN propagation lag), 429, and 5xx.
 */
export async function fetchWithRetry(
  url: string,
  options: AxiosRequestConfig = {},
  retries: number = GITHUB_CONFIG.MAX_RETRIES,
  delay: number = GITHUB_CONFIG.BASE_RETRY_DELAY,
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await axios.get(url, {
        ...options,
        timeout: options.timeout || GITHUB_CONFIG.REQUEST_TIMEOUT,
      });
    } catch (error: unknown) {
      lastError = error as Error;
      const axiosError = error as {
        response?: { status?: number };
        message?: string;
      };
      const statusCode = axiosError.response?.status;

      const isRetryable =
        statusCode &&
        RETRYABLE_STATUS_CODES.includes(
          statusCode as (typeof RETRYABLE_STATUS_CODES)[number],
        );

      if (isRetryable && attempt < retries - 1) {
        const waitTime = Math.min(
          delay * Math.pow(2, attempt),
          GITHUB_CONFIG.MAX_RETRY_DELAY,
        );
        logger.warn(
          `[GitHub] Retry ${attempt + 1}/${retries} after ${statusCode} — waiting ${waitTime}ms`,
          { url },
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (statusCode === 429) throw new GitHubRateLimitError();
      if (statusCode === 404) throw new GitHubNotFoundError("Resource", url);
      if (statusCode && statusCode >= 400) {
        throw new GitHubAPIError(
          `GitHub API failed: ${axiosError.message || "Unknown error"}`,
          statusCode,
          { url, attempt: attempt + 1 },
        );
      }

      throw error;
    }
  }

  throw new GitHubAPIError(
    `Max retries (${retries}) reached for URL: ${url}`,
    500,
    { lastError: lastError?.message },
  );
}
