import OpenAI from "openai";

// const openai = new OpenAI({
//   baseURL: "https://openrouter.ai/api/v1",
//   apiKey: process.env.OPENAI_API_KEY,
//   defaultHeaders: {
//     "HTTP-Referer": "https://gitvision.vercel.app/",
//     "X-Title": "https://gitvision.vercel.app/",
//   },
// });

const openai = new OpenAI({
  apiKey: "GEMINI_API_KEY",
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export async function getSummaryOfDiff(diff: string) {
  try {
    if (!diff) {
      console.warn("No diff provided for summary.");
      return "No diff provided"; // Improved fallback message
    }
    const completion = await openai.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "system",
          content: `You are an expert programmer, and you are trying to summarize a git diff.
      Reminders about the git diff format:
      For every file, there are a few metadata lines, like (for example):
      \`\`\`
      diff --git a/lib/index.js b/lib/index.js
      index aadf691..bfef603 100644
      --- a/lib/index.js
      +++ b/lib/index.js
      \`\`\`
      This means that \`lib/index.js\` was modified in this commit. Note that this is only an example.
      Then there is a specifier of the lines that were modified.
      A line starting with \`+\` means it was added.
      A line that starting with \`-\` means that line was deleted.
      A line that starts with neither \`+\` nor \`-\` is code given for context and better understanding.
      It is not part of the diff.
      [...]
      EXAMPLE SUMMARY COMMENTS:
      \`\`\`
      * Raised the amount of returned recordings from \`10\` to \`100\` [packages/server/recordings_api.ts], [packages/server/constants.ts]
      * Fixed a typo in the github action name [.github/workflows/gpt-commit-summarizer.yml]
      * Moved the \`octokit\` initialization to a separate file [src/octokit.ts], [src/index.ts]
      * Added an OpenAI API for completions [packages/utils/apis/openai.ts]
      * Lowered numeric tolerance for test files
      \`\`\`
      Most commits will have less comments than this examples list.
      The last comment does not include the file names,
      because there were more than two relevant files in the hypothetical commit.
      Do not include parts of the example in your summary.
      It is given only as an example of appropriate comments.`,
        },
        {
          role: "user",
          content: `Please summaries the following diff file: \n\n ${diff}`,
        },
      ],
    });

    if (
      !completion ||
      !completion.choices ||
      completion.choices.length === 0 ||
      !completion.choices[0].message
    ) {
      console.warn(
        "No summary returned from OpenAI. Possible reasons: empty response, rate limiting, or model unavailability."
      );
      return "No summary available due to OpenAI limitations."; // Improved fallback message
    }

    console.log("AI summary:", completion.choices[0].message.content);
    return completion.choices[0].message.content; // Return the content string directly
  } catch (error) {
    console.error("Error fetching summary from OpenAI:", error);
    return "Error generating summary"; // Fallback value
  }
}
