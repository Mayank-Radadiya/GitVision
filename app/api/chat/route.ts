import { streamText, createDataStreamResponse } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projectChats, chatMessages, projectTables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateQueryEmbedding } from "@/src/features/rag/services/embeddings";
import {
  searchSimilarCode,
  searchSimilarCodeInFile,
  formatRetrievedContext,
  getProjectContext,
  reRankResults,
  isSmallProject,
  getAllProjectFilesForContext,
} from "@/src/features/rag/services/vector-search";
import {
  classifyQuery,
} from "@/src/features/rag/services/rag/query-classifier";
import {
  fetchContext,
  type CodeContext,
} from "@/src/features/rag/services/rag/context-fetcher";
import { getRecentChatHistoryForContext } from "@/src/shared/lib/chat-history";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_GENERAL = `You are GitVision AI, a helpful and knowledgeable assistant.
Answer questions clearly and concisely. Use markdown formatting for readability.
When providing code examples, use fenced code blocks with language identifiers.`;

function buildSmallProjectSystemPrompt(
  projectName: string,
  fullContext: string,
  conversationHistory: string,
): string {
  return `You are GitVision AI, a code-aware assistant with full access to the "${projectName}" codebase.

FULL CODEBASE:
${fullContext}

INSTRUCTIONS:
- You have the complete codebase above. Answer questions directly from it.
- Reference specific file paths and function names when relevant.
- Use markdown with fenced code blocks.
- When suggesting changes, show before/after snippets.${
    conversationHistory && conversationHistory !== "No previous conversation."
      ? `\n\nPREVIOUS CONVERSATION:\n${conversationHistory}`
      : ""
  }`;
}

function buildRagSystemPrompt(
  projectName: string,
  context: string,
  projectStats: { languages: string[]; totalFiles: number; totalEmbeddings: number },
  conversationHistory: string,
): string {
  return `You are GitVision AI, a code-aware assistant analyzing the "${projectName}" project.

PROJECT INFO:
- Languages: ${projectStats.languages.join(", ") || "Unknown"}
- Total files: ${projectStats.totalFiles}
- Indexed chunks: ${projectStats.totalEmbeddings}

RETRIEVED CODE CONTEXT:
${context}

INSTRUCTIONS:
- Answer questions based on the code context provided above.
- Reference specific file paths and function names when relevant.
- If the context doesn't contain enough information, say so honestly.
- Use markdown formatting with fenced code blocks.
- When suggesting changes, show diff-style before/after snippets.
- Keep responses focused and actionable.${
    conversationHistory && conversationHistory !== "No previous conversation."
      ? `\n\nPREVIOUS CONVERSATION:\n${conversationHistory}`
      : ""
  }`;
}

// ---------------------------------------------------------------------------
// LLM-based standalone query rewrite
// ---------------------------------------------------------------------------

/**
 * Uses a small Gemini Flash call to rewrite the conversation into a
 * standalone search query. This prevents query drift on long threads and
 * produces a better embedding input than raw user messages.
 *
 * Returns the original userMessage as a fallback if the call fails.
 */
async function rewriteQueryForRetrieval(
  userMessage: string,
  conversationHistory: string,
): Promise<string> {
  // If there's no real history, the current message is already standalone
  if (
    !conversationHistory ||
    conversationHistory === "No previous conversation."
  ) {
    return userMessage;
  }

  try {
    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: `You are a search query optimizer for a code repository.
Given a conversation and the user's latest message, output ONLY a concise
standalone search query (max 20 words) that captures what the user wants to
find in the codebase. Output nothing else — no explanation, no punctuation
at the end.`,
      messages: [
        {
          role: "user",
          content: `Conversation so far:\n${conversationHistory}\n\nLatest message: ${userMessage}`,
        },
      ],
    });

    let rewritten = "";
    for await (const chunk of result.textStream) {
      rewritten += chunk;
    }

    return rewritten.trim() || userMessage;
  } catch {
    // Non-fatal — fall back to original message
    return userMessage;
  }
}

// ---------------------------------------------------------------------------
// Context-fetcher result → formatted string
// ---------------------------------------------------------------------------

/**
 * Format a CodeContext (from the intent-based fetcher) into the string
 * injected into the system prompt.
 */
function formatCodeContext(ctx: CodeContext): string {
  if (ctx.files.length === 0) return "";

  if (ctx.type === "dependency") {
    return `DEPENDENCY ANALYSIS:\n${JSON.stringify(ctx.metadata.dependencies, null, 2)}`;
  }

  if (ctx.type === "overview") {
    const stats = ctx.metadata.stats ?? {};
    const fileTypes = stats.fileTypes
      ? Object.entries(stats.fileTypes as Record<string, number>)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([ext, count]) => `  .${ext}: ${count} files`)
          .join("\n")
      : "";

    const keyFiles = ctx.files
      .map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 3000)}\n\`\`\``)
      .join("\n\n");

    return `PROJECT OVERVIEW:
- Total files: ${ctx.metadata.totalFiles}
- Stars: ${stats.stars ?? "?"} | Forks: ${stats.forks ?? "?"} | Commits: ${stats.commits ?? "?"}
- Folders: ${(ctx.metadata.folders ?? []).join(", ")}

FILE TYPE BREAKDOWN:
${fileTypes}

KEY FILES:
${keyFiles}`;
  }

  // file | folder
  const parts = ctx.files.map((f) => {
    if (f.summary && !f.content) {
      return `File: ${f.path}\n${f.summary}`;
    }
    return `\`\`\`\n// File: ${f.path}\n${f.content}\n\`\`\``;
  });

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Main RAG orchestration for large projects
// ---------------------------------------------------------------------------

/**
 * Classify the query, route to the appropriate fetcher, and fall back to
 * vector search + re-ranking if the fetcher returns nothing.
 *
 * Returns:
 *   - context string ready for the system prompt
 *   - relatedFiles array for the sources panel
 */
async function retrieveContext(
  projectId: string,
  userMessage: string,
  standaloneQuery: string,
): Promise<{ context: string; relatedFiles: string[] }> {
  // 1. Classify the standalone query
  const classified = classifyQuery(standaloneQuery);

  // 2. Try intent-based fetching when confidence is high enough
  if (
    classified.confidence >= 0.7 &&
    classified.intent !== "general-question"
  ) {
    try {
      const ctx: CodeContext = await fetchContext(projectId, classified);

      // If file-specific and large, fall back to in-file vector search
      if (
        classified.intent === "file-specific" &&
        ctx.files.length > 0 &&
        ctx.files[0].content.length > 8000
      ) {
        const targetFile = ctx.files[0].path;
        const queryEmbedding = await generateQueryEmbedding(standaloneQuery);
        const inFileResults = await searchSimilarCodeInFile(
          projectId,
          targetFile,
          queryEmbedding,
          6,
        );

        if (inFileResults.length > 0) {
          const inFileContext = await formatRetrievedContext(inFileResults);
          return {
            context: inFileContext,
            relatedFiles: [targetFile],
          };
        }
      }

      // If fetcher returned results, format and return
      if (ctx.files.length > 0) {
        const formatted = formatCodeContext(ctx);
        if (formatted) {
          const relatedFiles = ctx.files.map((f) => f.path);
          return { context: formatted, relatedFiles };
        }
      }
    } catch (err) {
      console.warn("[RAG] fetchContext failed, falling back to vector search:", err);
    }
  }

  // 3. Fallback: vector search + re-ranking
  const queryEmbedding = await generateQueryEmbedding(standaloneQuery);
  const rawResults = await searchSimilarCode(projectId, queryEmbedding, 12, 0.45);
  const ranked = reRankResults(rawResults, standaloneQuery, 8);
  const context = await formatRetrievedContext(ranked);
  const relatedFiles = [...new Set(ranked.map((r) => r.filePath))];

  return { context, relatedFiles };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const body = await req.json();
    const { messages, chatId, projectId, mode = "general" } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
      });
    }

    const userMessage = messages[messages.length - 1]?.content as string | undefined;
    if (!userMessage) {
      return new Response(JSON.stringify({ error: "Empty message" }), {
        status: 400,
      });
    }

    // Verify chat ownership and store user message
    if (chatId) {
      const [chat] = await db
        .select({ userId: projectChats.userId })
        .from(projectChats)
        .where(eq(projectChats.id, chatId))
        .limit(1);

      if (!chat || chat.userId !== userId) {
        return new Response(JSON.stringify({ error: "Chat not found" }), {
          status: 404,
        });
      }

      await db.insert(chatMessages).values({
        chatId,
        role: "user",
        content: userMessage,
        createdAt: new Date(),
      });
    }

    // -----------------------------------------------------------------------
    // Build system prompt
    // -----------------------------------------------------------------------

    let systemPrompt = SYSTEM_PROMPT_GENERAL;
    let relatedFiles: string[] = [];

    if (mode === "project" && projectId) {
      try {
        // Load project metadata (single indexed read)
        const [project] = await db
          .select({
            projectName: projectTables.projectName,
            embeddingStatus: projectTables.embeddingStatus,
            estimatedTokens: projectTables.estimatedTokens,
          })
          .from(projectTables)
          .where(eq(projectTables.id, projectId))
          .limit(1);

        if (!project || project.embeddingStatus !== "completed") {
          systemPrompt = `You are GitVision AI. The project "${
            project?.projectName ?? "Unknown"
          }" has not been fully indexed yet (status: ${
            project?.embeddingStatus ?? "unknown"
          }). Please let the user know that embeddings need to be generated before codebase-aware chat can work. You can still answer general programming questions.`;
        } else {
          // Conversation history for both prompts and query rewrite
          const conversationHistory = chatId
            ? await getRecentChatHistoryForContext(chatId, 4)
            : "No previous conversation.";

          // ------------------------------------------------------------------
          // FAST PATH: small project — dump entire codebase into context
          // ------------------------------------------------------------------
          if (isSmallProject(project.estimatedTokens)) {
            const fullContext = await getAllProjectFilesForContext(projectId);
            systemPrompt = buildSmallProjectSystemPrompt(
              project.projectName,
              fullContext,
              conversationHistory,
            );
            // No specific files to highlight — the whole project is in context
          } else {
            // ------------------------------------------------------------------
            // RAG PATH: large project — rewrite query → classify → retrieve
            // ------------------------------------------------------------------

            // Rewrite only when there's real history (skips the LLM call on
            // first message, saving ~100ms)
            const standaloneQuery = await rewriteQueryForRetrieval(
              userMessage,
              conversationHistory,
            );

            const { context, relatedFiles: files } = await retrieveContext(
              projectId,
              userMessage,
              standaloneQuery,
            );

            relatedFiles = files;

            const projectStats = await getProjectContext(projectId);

            systemPrompt = buildRagSystemPrompt(
              project.projectName,
              context,
              projectStats,
              conversationHistory,
            );
          }
        }
      } catch (ragError) {
        console.error("[RAG] Retrieval error, falling back to general mode:", ragError);
        // systemPrompt stays as SYSTEM_PROMPT_GENERAL — graceful degradation
      }
    }

    // -----------------------------------------------------------------------
    // Stream response with data events for the sources UI
    // -----------------------------------------------------------------------

    const dataStream = createDataStreamResponse({
      execute(stream) {
        // Fire "searching" event immediately so the client shows the skeleton
        stream.writeData({ type: "status", value: "searching" });

        // Once sources are known, send them (they were resolved above before
        // this callback runs — in the RAG path — so we emit them right away)
        if (relatedFiles.length > 0) {
          stream.writeData({ type: "sources", files: relatedFiles });
        }

        // Stream LLM tokens
        const result = streamText({
          model: google("gemini-2.5-flash"),
          system: systemPrompt,
          messages,
          onFinish: async ({ text }) => {
            if (!chatId) return;

            await Promise.all([
              db.insert(chatMessages).values({
                chatId,
                role: "assistant",
                content: text,
                relatedFiles: relatedFiles.length > 0 ? relatedFiles : [],
                createdAt: new Date(),
              }),
              db
                .update(projectChats)
                .set({ updatedAt: new Date() })
                .where(eq(projectChats.id, chatId)),
            ]);

            // Auto-generate title from first message
            const [chat] = await db
              .select({ title: projectChats.title })
              .from(projectChats)
              .where(eq(projectChats.id, chatId))
              .limit(1);

            if (
              chat?.title === "General Chat" ||
              chat?.title === "Project Chat" ||
              chat?.title === "New Chat"
            ) {
              await db
                .update(projectChats)
                .set({ title: userMessage.slice(0, 80).trim() })
                .where(eq(projectChats.id, chatId));
            }
          },
        });

        result.mergeIntoDataStream(stream);
      },
    });

    return dataStream;
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
