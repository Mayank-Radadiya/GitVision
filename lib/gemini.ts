import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is Missing");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

export const aISummariesCommit = async (diff: string) => {
  // https//github.com/OwnerName/repoName/commit/commitHash/diff
  //https://github.com/Mayank-Radadiya/Sundown-Studio/commit/5c18b1c3e7efacd7e621f7a9aaeeedbd55ac2211.diff
  const response = await model.generateContent([
    `You are an expert software engineer reviewing a Git diff. Your task is to generate a clear, structured summary of the changes.

🔹 Git diff format reminders:
- File changes start like:
  diff --git a/path/file.js b/path/file.js
- Lines beginning with \`+\` were **added
- Lines beginning with \`-\` were --removed
- Other lines are for ->context only

🔹 Your summary should include:
1. What changed** – functions, logic, variables, structure, etc.
2. Where it changed** – file names, modules, functions, or components
3. Why it changed** – purpose of the change (bug fix, feature, refactor, etc.)
4. How behavior changed** – describe before vs after if relevant
5. Impact** – performance, readability, usability, maintainability, etc.

🔹 Example format (do not copy this into your summary):
* Increased max recordings returned from 10 to 100 [server/api.ts, constants.ts]
* Fixed typo in GitHub workflow [.github/workflows/build.yml]
* Moved Octokit setup to separate module [src/octokit.ts, src/index.ts]

Now summarize the following Git diff:

${diff}
`,
  ]);
  return response.response.text();
};
