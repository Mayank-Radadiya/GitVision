// ============================================================================
// GitHub Module — Type Definitions
// ============================================================================
// All interfaces and type aliases used across the GitHub module.
// Import these from "@/src/lib/github" without pulling in heavy dependencies.

/** GitHub repository coordinates extracted from a URL */
export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

/** Commit data shaped for database insertion */
export interface CommitData {
  commitHash: string;
  commitMessage: string;
  authorName: string;
  authorAvatar: string;
  authorEmail: string;
  authorDate: Date;
  committerName: string;
  committerEmail: string;
  committerDate: Date;
  projectId: string;
}

/** File metadata returned after storing repository files */
export interface FileInfo {
  id: string;
  path: string;
  size: number | undefined;
  sha: string;
}

/** Result of project creation */
export interface CreateProjectResult {
  projectId: string;
}

/** File object shape from the GitHub REST API (used in diff extraction) */
export interface GitHubFile {
  filename: string;
  previous_filename?: string;
  status: string;
  patch?: string;
}

/** A single language node returned by GitHub's GraphQL `languages` query */
export interface LanguageNode {
  name: string;
  color: string | null;
}

/** A language edge — combines the language node with the byte-size count */
export interface LanguageEdge {
  size: number;
  node: LanguageNode;
}

/**
 * Shape of the single GraphQL response used in `createNewProject`.
 * Consolidates stars, forks, branch count, contributor count, and
 * the latest N commits into one network round-trip.
 */
export interface GraphQLRepoData {
  repository: {
    stargazerCount: number;
    forkCount: number;
    refs: { totalCount: number };
    mentionableUsers: { totalCount: number };
    /** Top 10 languages ordered by byte size. May be empty for repos with no detectable code. */
    languages: {
      edges: LanguageEdge[];
    };
    defaultBranchRef: {
      target: {
        history: {
          totalCount: number;
          nodes: {
            oid: string;
            messageHeadline: string;
            message: string;
            author: {
              name: string;
              email: string;
              avatarUrl: string;
            } | null;
            committer: {
              name: string;
              email: string;
            } | null;
            committedDate: string;
            authoredDate: string;
          }[];
        };
      };
    } | null;
  };
}

/**
 * Shape of the GraphQL response for fetching issues + inline comments.
 * Replaces the REST-based approach to avoid N+1 pagination.
 */
export interface GraphQLIssuesData {
  repository: {
    issues: {
      totalCount: number;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: IssueNode[];
    };
    pullRequests: {
      totalCount: number;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: PullRequestNode[];
    };
  };
}

/** Shared shape for issue nodes from GraphQL */
export interface IssueNode {
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  author: { login: string; avatarUrl: string } | null;
  comments: {
    nodes: CommentNode[];
  };
}

/** PR nodes extend issue nodes with the MERGED state */
export interface PullRequestNode extends Omit<IssueNode, "state"> {
  state: "OPEN" | "CLOSED" | "MERGED";
}

/** Single comment node from GraphQL */
export interface CommentNode {
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string; avatarUrl: string } | null;
}

/**
 * Union type for processing both issue and PR nodes in the same function.
 * MERGED maps to "closed" when stored in the database.
 */
export type IssueOrPrNode = {
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  author: { login: string; avatarUrl: string } | null;
  comments: {
    nodes: CommentNode[];
  };
};
