// ============================================================================
// GitHub Module — Configuration Constants & GraphQL Queries
// ============================================================================
// All hardcoded values, regex patterns, and query strings live here.
// Easy to tune without touching business logic.

/** Tuning knobs for GitHub API interaction and data processing */
export const GITHUB_CONFIG = {
  /** Items per page for REST API pagination */
  DEFAULT_PER_PAGE: 100,
  /** Max retry attempts for failed HTTP requests */
  MAX_RETRIES: 3,
  /** Base delay (ms) for exponential backoff */
  BASE_RETRY_DELAY: 2000,
  /** Upper cap on backoff delay (ms) */
  MAX_RETRY_DELAY: 10000,
  /** Batch size for bulk DB inserts (commits, issues, files) */
  COMMIT_BATCH_SIZE: 10,
  /**
   * Batch size for stream-to-DB file insertion during tarball extraction.
   * Files are flushed to the database every N entries to keep memory flat.
   */
  FILE_BATCH_SIZE: 10,
  /** Max character length of diff data sent to AI summariser */
  DIFF_MAX_LENGTH: 10000,
  /** HTTP timeout for generic API calls (ms) */
  REQUEST_TIMEOUT: 30000,
  /**
   * Commits to pull via GraphQL during project creation.
   * Older history can be loaded lazily via a "Load More" button.
   */
  INITIAL_COMMIT_COUNT: 100,
  /**
   * Issues + PRs pulled per GraphQL page during sync.
   * Ordered by most recently updated. The sync loops pages until it has
   * fetched everything (or hits MAX_ISSUE_PAGES as a safety valve).
   */
  INITIAL_ISSUE_COUNT: 50,
  /**
   * Hard cap on pagination pages when syncing issues/PRs.
   * Prevents a multi-thousand-issue repo from running away during project
   * creation; 50 * 40 = up to 2,000 issues + 2,000 PRs.
   * ponytail: ceiling — raise/remove if a repo legitimately needs more.
   */
  MAX_ISSUE_PAGES: 40,
  /** Comments to fetch per issue/PR inline via GraphQL */
  COMMENTS_PER_ISSUE: 10,
} as const;

/** HTTP status codes that warrant an automatic retry */
export const RETRYABLE_STATUS_CODES = [404, 429, 500, 502, 503, 504] as const;

/** Fallback values for missing author metadata */
export const DEFAULTS = {
  AVATAR: "https://via.placeholder.com/150",
  EMAIL: "unknown@example.com",
  NAME: "Unknown",
} as const;

/**
 * File patterns to skip during tarball extraction.
 * Matches build artefacts, dependency dirs, IDE config, binaries, etc.
 */
export const IGNORED_FILE_PATTERNS = [
  /^node_modules\//,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /^\.nuxt\//,
  /^out\//,
  /^vendor\//,
  /^coverage\//,
  /^\.cache\//,
  /^\.turbo\//,
  /^__pycache__\//,
  /^env\//,
  /^\.vscode\//,
  /^\.idea\//,
  /^\.angular\//,
  /^\.jest\//,
  /^logs?\//,
  /^storage\/logs\//,
  /\.log$/i,
  /^__snapshots__\//,
  /\.env(\..*)?$/i,
  /\.DS_Store$/,
  /\.eslintcache$/,
  /\.prettiercache$/,
  /\.(png|jpe?g|gif|svg|webp|bmp|ico|avif|tiff?|heic|heif)$/i,
  /\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v|3gp|mpg|mpeg)$/i,
  /\.(mp3|wav|ogg|m4a|flac|aac|wma)$/i,
  /\.(zip|tar|gz|rar|7z|bz2|xz|dmg|iso)$/i,
  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i,
  /\.(woff2?|ttf|eot|otf)$/i,
  /\.pyc$/,
] as const;

/**
 * File patterns to exclude from AI diff context.
 * Lock files and generated assets waste the AI's context window.
 */
export const AI_DIFF_IGNORE_PATTERNS = [
  /\.lock$/,
  /-lock\.json$/,
  /\.svg$/,
  /\.min\.(js|css)$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /bun\.lockb$/,
] as const;

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

/**
 * Single GraphQL query that replaces 4 REST calls in createNewProject.
 * Returns: stars, forks, branch count, contributor estimate,
 * total commit count, and the latest N commit nodes.
 */
export const REPO_METADATA_QUERY = `
  query($owner: String!, $repo: String!, $commitCount: Int!) {
    repository(owner: $owner, name: $repo) {
      stargazerCount
      forkCount
      refs(refPrefix: "refs/heads/") {
        totalCount
      }
      mentionableUsers {
        totalCount
      }
      languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
        edges {
          size
          node {
            name
            color
          }
        }
      }
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: $commitCount) {
              totalCount
              nodes {
                oid
                messageHeadline
                message
                author {
                  name
                  email
                  avatarUrl
                }
                committer {
                  name
                  email
                }
                committedDate
                authoredDate
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query for issues + pull requests with inline comments.
 * Fetches both separately to correctly distinguish issues from PRs.
 */
export const ISSUES_AND_PRS_QUERY = `
  query(
    $owner: String!,
    $repo: String!,
    $issueCount: Int!,
    $prCount: Int!,
    $commentCount: Int!,
    $issueCursor: String,
    $prCursor: String
  ) {
    repository(owner: $owner, name: $repo) {
      issues(
        first: $issueCount,
        after: $issueCursor,
        states: [OPEN, CLOSED],
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          title
          body
          state
          createdAt
          updatedAt
          closedAt
          author { login avatarUrl }
          comments(first: $commentCount) {
            nodes {
              body
              createdAt
              updatedAt
              author { login avatarUrl }
            }
          }
        }
      }
      pullRequests(
        first: $prCount,
        after: $prCursor,
        states: [OPEN, CLOSED, MERGED],
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          title
          body
          state
          createdAt
          updatedAt
          closedAt
          author { login avatarUrl }
          comments(first: $commentCount) {
            nodes {
              body
              createdAt
              updatedAt
              author { login avatarUrl }
            }
          }
        }
      }
    }
  }
`;
