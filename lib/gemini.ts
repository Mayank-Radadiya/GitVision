import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is Missing");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export const aISummariesCommit = async (diff: string) => {
  try {
    // https//github.com/OwnerName/repoName/commit/commitHash/diff
    //https://github.com/Mayank-Radadiya/Sundown-Studio/commit/5c18b1c3e7efacd7e621f7a9aaeeedbd55ac2211.diff
    const response = await model.generateContent([
      `You are an expert code reviewer analyzing a Git commit diff for GitVision - a tool that helps developers understand code changes at a glance.

📋 YOUR TASK:
Generate a clear, concise, developer-friendly summary that explains what changed, why it matters, and the impact. Focus on helping developers quickly understand the commit without reading the entire diff.

📖 UNDERSTANDING GIT DIFF FORMAT:
• \`diff --git a/file.js b/file.js\` = File being modified
• Lines starting with \`+\` = Added code (new lines)
• Lines starting with \`-\` = Removed code (deleted lines)
• Lines starting with \`@@\` = Line number ranges
• Unchanged lines = Context only (ignore these)
• \`new file\` = File was created
• \`deleted file\` = File was removed
• \`renamed from/to\` = File was renamed/moved

✅ WHAT TO INCLUDE IN YOUR SUMMARY:
1. **Primary Purpose**: What is the main goal of this commit? (feature, bugfix, refactor, performance, docs, etc.)
2. **Key Changes**: What specific code/logic/structure changed?
3. **Affected Areas**: Which files, functions, or components were modified?
4. **Why It Matters**: The reason or problem this change solves
5. **Impact**: How this affects the codebase (performance, UX, maintainability, security, etc.)
6. **Notable Details**: Important implementation details, breaking changes, or dependencies

❌ WHAT TO AVOID:
• Don't just list file names without context
• Don't repeat obvious information from the diff
• Don't use vague terms like "updated code" or "made changes"
• Don't miss the bigger picture by focusing only on syntax changes
• Don't ignore the "why" - always explain the purpose

📝 OUTPUT FORMAT:
Use bullet points with this structure:
• [Emoji] **Action** - Brief description [affected files/components]

Emojis to use:
• ✨ New features or capabilities
• 🐛 Bug fixes
• ♻️ Code refactoring or restructuring
• ⚡ Performance improvements
• 🔒 Security enhancements
• 📝 Documentation updates
• 🎨 UI/UX improvements
• 🔧 Configuration or tooling changes
• 🗑️ Code removal or cleanup
• 🚀 Deployment or build improvements

EXAMPLE SUMMARY (for reference, don't copy):
\`\`\`
✨ **Added user authentication flow** - Implemented JWT-based login and signup with session management [auth/login.ts, auth/signup.ts, middleware/auth.ts]
   → Impact: Users can now securely access protected routes; sessions expire after 24 hours

♻️ **Refactored database queries** - Replaced raw SQL with Prisma ORM for type safety [db/queries.ts, models/user.ts]
   → Impact: Reduced potential SQL injection vulnerabilities and improved code maintainability

� **Fixed memory leak in WebSocket connections** - Added proper cleanup in useEffect hook [hooks/useWebSocket.ts]
   → Impact: Prevents browser crashes on long-running sessions
\`\`\`

🎯 ANALYSIS GUIDELINES:
• **For new features**: Explain what the feature does and how users benefit
• **For bug fixes**: Describe the bug and how it was fixed
• **For refactoring**: Explain why the code was restructured and the benefits
• **For performance**: Mention specific optimizations and expected improvements
• **For config/tooling**: Explain what changed in the development or build process
• **For deletions**: Explain why code was removed (deprecated, unused, replaced, etc.)

🔍 SPECIAL CASES:
• **Large commits**: Group related changes together, prioritize the most important
• **Multiple unrelated changes**: Separate into distinct bullet points
• **Dependency updates**: Mention version changes and why (security, features, bugs)
• **Breaking changes**: Clearly mark with ⚠️ and explain migration path if evident
• **Configuration changes**: Explain what behavior changes as a result

Now analyze this Git diff and provide your summary:

---
${diff}
---

Remember: Your summary should help developers understand this commit in 30 seconds or less. Be clear, specific, and focus on what matters.`,
    ]);
    return response.response.text();
  } catch (error:any) {
    // Handle specific error types
    if (error?.status === 429) {
      console.error("Gemini API quota exceeded:", error.message);
      return "⏳ AI summary temporarily unavailable due to API quota limits. Please try again later.";
    } else if (error?.status === 404) {
      console.error("Gemini model not found:", error.message);
      return "⚠️ AI model not available. Please contact support or check your API configuration.";
    } else if (error?.message?.includes("quota")) {
      console.error("Gemini API quota issue:", error.message);
      return "⏳ AI summary quota exceeded. Please try again in 24 hours.";
    } else {
      console.error("Error generating AI summary:", error);
      return "😥 Could not generate AI summary at this time. Please try again later.";
    }
  }
};
