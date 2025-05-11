import { Octokit } from "octokit";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function getRepositoryFiles(owner: string, repo: string) {
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
        item.path?.match(/\.(js|ts|jsx|tsx|py|java|cpp|php|rb|go|rs|json|html|css)$/i)
    );

    console.log(
      `Found ${codeFiles.length} code files in repository ${owner}/${repo}:`
    );

    for (const file of codeFiles) {
      const { data: blob } = await octokit.rest.git.getBlob({
        owner,
        repo,
        file_sha: file.sha!,
      });

      const content = Buffer.from(blob.content, "base64").toString("utf-8");

      console.log(`\n📄 File: ${file.path}`);
      console.log("───────────────────────────────────────────────");
      console.log(content);
      console.log("───────────────────────────────────────────────\n");
    }

    return codeFiles;
  } catch (error) {
    console.error("Error fetching repository files:", error);
    throw error;
  }
}
