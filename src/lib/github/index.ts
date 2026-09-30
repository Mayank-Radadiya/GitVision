// ============================================================================
// GitHub Module — Public API (Barrel File)
// ============================================================================
// This is the only file the rest of the application should import from.
// Internal utilities, queries, and the Octokit client are NOT exported
// to enforce strict encapsulation.

// ── Services ──
export { createNewProject } from "./services/project";
export { getRepositoryFiles } from "./services/files";
export { resyncRepositoryFiles } from "./services/resync";
export type { ResyncResult } from "./services/resync";
export { getCommitHashes, getAiSummaryOfCommit } from "./services/commits";
export { syncIssuesAndComments } from "./services/issues";

// ── Errors (so routers/middleware can use instanceof checks) ──
export {
  GitHubError,
  GitHubAPIError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubValidationError,
} from "./errors";

// ── HTTP / Auth Utilities ──
export { getGitHubAuthHeader } from "./client";

