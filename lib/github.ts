import { Octokit } from "octokit";
import { db } from "@/drizzle";
import { commitsTable, projectTables } from "@/drizzle/schema/schema";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

function removeGitSuffix(url: string) {
  return url.endsWith(".git") ? url.slice(0, -4) : url;
}

// Function to get commit hashes from a GitHub repository and store them in the database
export const getCommitHashes = async (githubUrl: string, projectId: string) => {
  const GithubUrl = removeGitSuffix(githubUrl);
  const [owner, repo] = GithubUrl.split("/").slice(-2);

  if (!owner || !repo) {
    throw new Error("Invalid GitHub URL.");
  }

  try {
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      per_page: 100, // Get more commits per page for efficiency
    });

    // Process commits and prepare for database insertion
    const commitDataForDb = [];

    // Process commits for database insertion
    for (const commit of commits) {
      commitDataForDb.push({
        commitHash: commit.sha,
        commitMessage: commit.commit.message,
        authorName: commit.commit.author?.name || "Unknown",
        authorAvatar:
          commit.author?.avatar_url || "https://via.placeholder.com/150",
        authorEmail: commit.commit.author?.email || "unknown@example.com",
        authorDate: commit.commit.author?.date
          ? new Date(commit.commit.author.date)
          : new Date(),
        committerName: commit.commit.committer?.name || "Unknown",
        committerEmail: commit.commit.committer?.email || "unknown@example.com",
        committerDate: commit.commit.committer?.date
          ? new Date(commit.commit.committer.date)
          : new Date(),
        projectId: projectId, // Link commits to the project
      });

      // Optional: Save to database every few commits to avoid losing progress
      if (commitDataForDb.length % 10 === 0 && commitDataForDb.length > 0) {
        console.log(
          `Saving batch of ${commitDataForDb.length} commits to database...`
        );
        await db.insert(commitsTable).values(commitDataForDb.slice(-10));
      }
    }

    // Insert any remaining commit data into the database
    if (commitDataForDb.length > 0) {
      console.log(
        `Saving final batch of ${
          commitDataForDb.length % 10 || commitDataForDb.length
        } commits to database...`
      );
      await db
        .insert(commitsTable)
        .values(
          commitDataForDb.slice(
            -(commitDataForDb.length % 10 || commitDataForDb.length)
          )
        );
    }

    return commitDataForDb.length; // Return the number of commits stored
  } catch (error) {
    console.error("Error fetching or storing commits:", error);
    throw error;
  }
};

export async function createNewProject(
  url: string,
  projectName: string,
  userId: string
): Promise<{ projectId: string }> {
  try {
    // remove .git suffix if present
    const GithubUrl = removeGitSuffix(url);
    // Extract owner and repo from the URL
    const [owner, repo] = GithubUrl.split("/").slice(-2);

    if (!owner || !repo) {
      throw new Error("Invalid GitHub URL.");
    }

    // Get stars & forks
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });

    // Get branches
    const branches = await octokit.paginate(octokit.rest.repos.listBranches, {
      owner,
      repo,
      per_page: 100,
    });

    // Get contributors
    const contributors = await octokit.paginate(
      octokit.rest.repos.listContributors,
      {
        owner,
        repo,
        per_page: 100,
      }
    );

    // Get commits (latest commit list to count total)
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      per_page: 100,
    });

    // Create project in database
    const [newProject] = await db
      .insert(projectTables)
      .values({
        projectName: projectName || repoData.name,
        githubUrl: url,
        ownerId: userId,
        star: repoData.stargazers_count,
        forks: repoData.forks_count,
        totalBranches: branches.length,
        totalContributors: contributors.length,
        totalCommits: commits.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!newProject || !newProject.id) {
      throw new Error("Failed to create project in database");
    }

    return {
      projectId: newProject.id,
    };
  } catch (err) {
    console.error("Error creating new project:", err);
    throw err;
  }
}

export async function getRepositoryFiles(
  owner: string,
  repo: string,
  projectId?: string
) {
  try {
    // Step 1: Get the default branch
    const {
      data: { default_branch },
    } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    // Step 2: Get the latest commit to get the tree SHA
    const {
      data: {
        commit: {
          tree: { sha: treeSha },
        },
      },
    } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: default_branch,
    });

    // Step 3: Get the full tree recursively
    const {
      data: { tree },
    } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: "1",
    });

    // Step 4: Filter out ignored files and directories
    const ignoredPatterns = [
      /^node_modules\//,
      /^dist\//,
      /^build\//,
      /^\.next\//,
      /^\.nuxt\//,
      /^out\//,
      /^coverage\//,
      /^\.vscode\//,
      /^\.idea\//,
      /^logs?\//,
      /^__snapshots__\//,
      /\.log$/i,
      /\.env(\..*)?$/i,
      /\.DS_Store$/,
      /^\.cache\//,
      /\.eslintcache$/,
      /\.prettiercache$/,
      /^vendor\//,
      /^\.angular\//,
      /^\.jest\//,
      /^storage\/logs\//,
      /^env\//,
      /^__pycache__\//,
      /\.pyc$/,
      /^\.turbo\//,
    ];
    // Step 4: Filter only code files
    const codeFiles = tree.filter((item) => {
      if (item.type !== "blob") return false;
      if (!item.path) return false;

      // Exclude if matches any ignored pattern
      return !ignoredPatterns.some((pattern) => pattern.test(item.path));
    });

    // If projectId is provided, store files in database
    if (projectId) {
      const fileDataForDb = [];

      // Process each file to prepare for database insertion
      for (const file of codeFiles) {
        try {
          // Get file content
          const { data: blob } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: file.sha!,
          });

          const content = Buffer.from(blob.content, "base64").toString("utf-8");

          // Add file data to array for database insertion
          fileDataForDb.push({
            fileName: file.path || "unknown",
            code: content,
            projectId: projectId,
          });
        } catch (err) {
          console.error(`Error processing file ${file.path}:`, err);
          // Continue with other files even if one fails
        }
      }

      // Insert file data into database in batches to avoid overwhelming the database
      if (fileDataForDb.length > 0) {
        // Import the projectFiles table
        const { projectFiles } = await import("@/drizzle/schema/schema");

        // Insert in batches of 20 to avoid overwhelming the database
        const batchSize = 20;
        for (let i = 0; i < fileDataForDb.length; i += batchSize) {
          const batch = fileDataForDb.slice(i, i + batchSize);
          await db.insert(projectFiles).values(batch);
        }
      }
    }

    return codeFiles;
  } catch (error) {
    console.error("Error fetching repository files:", error);
    throw error;
  }
}
