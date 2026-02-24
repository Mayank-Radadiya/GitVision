// ============================================================================
// GitHub Module — Custom Error Classes
// ============================================================================
// Isolated so other parts of the app (tRPC routers, middleware) can
// import and check `instanceof` without circular dependencies.

/** Base error for all GitHub-related failures */
export class GitHubError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GitHubError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Thrown when user-provided input is invalid */
export class GitHubValidationError extends GitHubError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "GITHUB_VALIDATION_ERROR", 400, details);
    this.name = "GitHubValidationError";
  }
}

/** Thrown when the GitHub API returns an error response */
export class GitHubAPIError extends GitHubError {
  constructor(
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message, "GITHUB_API_ERROR", statusCode, details);
    this.name = "GitHubAPIError";
  }
}

/** Thrown when the GitHub API rate limit is exceeded */
export class GitHubRateLimitError extends GitHubError {
  constructor(message: string = "GitHub API rate limit exceeded") {
    super(message, "GITHUB_RATE_LIMIT", 429);
    this.name = "GitHubRateLimitError";
  }
}

/** Thrown when a requested resource cannot be found */
export class GitHubNotFoundError extends GitHubError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found`, "GITHUB_NOT_FOUND", 404, {
      resource,
      identifier,
    });
    this.name = "GitHubNotFoundError";
  }
}
