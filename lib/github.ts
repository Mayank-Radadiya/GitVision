import { Octokit } from "octokit";
import { db } from "@/drizzle";
import { commitsTable, projectTables } from "@/drizzle/schema/schema";
import axios from "axios";
import { getSummaryOfDiff } from "./openAi";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

function removeGitSuffix(url: string) {
  return url.endsWith(".git") ? url.slice(0, -4) : url;
}

async function fetchWithRetry(
  url: string,
  options: any,
  retries = 3,
  delay = 2000
) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, options);
    } catch (error: any) {
      if (error.response?.status === 429 && i < retries - 1) {
        console.warn(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries reached");
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

    // Process commits with a delay between each to avoid rate limiting
    for (const commit of commits) {
      let aiSummary = "";
      try {
        console.log(`Generating AI summary for commit ${commit.sha}...`);

        // Add delay between each commit summary request
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const summaryResult = await getSummaryOfCommit(commit.sha, owner, repo);

        // Handle null or undefined summaryResult
        aiSummary = summaryResult || "No summary available";

        console.log(`AI summary for commit ${commit.sha}:`, aiSummary);
      } catch (err) {
        console.error(
          `Error generating AI summary for commit ${commit.sha}:`,
          err
        );
        aiSummary = "Error generating summary"; // Fallback value
      }

      commitDataForDb.push({
        commitHash: commit.sha,
        commitMessage: commit.commit.message,
        authorName: commit.commit.author?.name || "Unknown",
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
        AiSummary: aiSummary, // Fixed case to match schema definition
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
    throw error; // Re-throw the error so callers can handle it
  }
};

export async function createNewProject(
  url: string,
  projectName: string,
  userId: string
): Promise<{ projectId: string }> {
  try {
    const GithubUrl = removeGitSuffix(url);
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

    // Start process to store commits in the database (non-blocking)
    try {
      // This will store the commits in the database in the background
      getCommitHashes(url, newProject.id).catch((err) =>
        console.error(`Background commit processing error: ${err}`)
      );
    } catch (error) {
      console.error("Error starting commit processing:", error);
      // We continue even if commit processing fails to start
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

    // Step 4: Filter only code files
    const codeFiles = tree.filter(
      (item) =>
        item.type === "blob" &&
        item.path?.match(
          /\.(js|ts|jsx|tsx|py|java|cpp|php|rb|go|rs|json|html|css)$/i
        )
    );

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

export async function getSummaryOfCommit(
  commitHash: string,
  owner: string,
  repo: string
) {
  try {
    // First, get the diff data with retry mechanism
    const { data } = await fetchWithRetry(
      `https://github.com/${owner}/${repo}/commit/${commitHash}.diff`,
      {
        headers: {
          Accept: "application/vnd.github.v3.diff",
          // Add User-Agent header to indicate a legitimate request
          "User-Agent": "GitVision App (https://gitvision.vercel.app/)",
        },
      },
      3, // 3 retries
      5000 // 5 seconds delay between retries
    );

    // If diff data is too large, truncate it to avoid overwhelming the OpenAI API
    const truncatedData =
      data.length > 10000
        ? data.substring(0, 10000) + "\n\n[diff truncated due to size]"
        : data;

    // Add delay before making OpenAI API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    const summary = await getSummaryOfDiff(truncatedData);

    // Summary is now returned as a string directly from getSummaryOfDiff
    // No need to do any further processing
    return summary;
  } catch (error) {
    console.error("Error fetching commit summary:", error);
    return "Error generating summary"; // Fallback value
  }
}
