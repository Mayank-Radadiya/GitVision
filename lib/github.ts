import { Octokit } from "octokit";
import { getRepositoryFiles } from "./getRepositoryFiles";

type Response = {
  commitMessage: string;
  commitHash: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commitDate: string;
};

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

function removeGitSuffix(url: string) {
  return url.endsWith(".git") ? url.slice(0, -4) : url;
}

export const getCommitHashes = async (githubUrl: string) => {
  const GithubUrl = removeGitSuffix(githubUrl);
  const [owner, repo] = GithubUrl.split("/").slice(-2);
  console.log("Owner:", owner);
  console.log("Repo:", repo);

  if (!owner || !repo) {
    throw new Error("Invalid GitHub URL.");
  }

  try {
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      per_page: 1, // max per page
    });

    getRepositoryFiles(owner, repo);

    const commitData = commits.map(
      (commit: any): Response => ({
        commitMessage: commit.commit.message,
        commitHash: commit.sha,
        commitAuthorName: commit.commit.author.name,
        commitAuthorAvatar: commit.author?.avatar_url || "",
        commitDate: new Date(commit.commit.author.date).toLocaleString(),
      })
    );

    console.log(commitData);
  } catch (error) {
    console.error("Error fetching commits:", error);
  }
};

getCommitHashes("https://github.com/Mayank-Radadiya/Sundown-Studio");
