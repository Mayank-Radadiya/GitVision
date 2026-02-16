import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projectChats, chatMessages, projectTables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateQueryEmbedding } from "@/src/features/rag/services/embeddings";
import {
  searchSimilarCode,
  formatRetrievedContext,
  getProjectContext,
} from "@/src/features/rag/services/vector-search";
import { getRecentChatHistoryForContext } from "@/src/shared/lib/chat-history";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_PROMPT_GENERAL = `You are GitVision AI, a helpful and knowledgeable assistant. 
Answer questions clearly and concisely. Use markdown formatting for readability.
When providing code examples, use fenced code blocks with language identifiers.`;

function buildCodebaseSystemPrompt(
  projectName: string,
  context: string,
  projectStats: {
    languages: string[];
    totalFiles: number;
    totalEmbeddings: number;
  },
) {
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
- Keep responses focused and actionable.`;
}

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

    const userMessage = messages[messages.length - 1]?.content;
    if (!userMessage) {
      return new Response(JSON.stringify({ error: "Empty message" }), {
        status: 400,
      });
    }

    // Verify chat ownership if chatId provided
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

      // Store user message
      await db.insert(chatMessages).values({
        chatId,
        role: "user",
        content: userMessage,
        createdAt: new Date(),
      });
    }

    let systemPrompt = SYSTEM_PROMPT_GENERAL;
    let relatedFiles: string[] = [];

    // Codebase mode: retrieve context via RAG
    if (mode === "project" && projectId) {
      try {
        // Get project info
        const [project] = await db
          .select({
            projectName: projectTables.projectName,
            embeddingStatus: projectTables.embeddingStatus,
          })
          .from(projectTables)
          .where(eq(projectTables.id, projectId))
          .limit(1);

        if (project && project.embeddingStatus === "completed") {
          // Generate query embedding and search
          const queryEmbedding = await generateQueryEmbedding(userMessage);
          const searchResults = await searchSimilarCode(
            projectId,
            queryEmbedding,
            8,
            0.5,
          );
          const formattedContext = await formatRetrievedContext(searchResults);
          const projectStats = await getProjectContext(projectId);

          relatedFiles = [...new Set(searchResults.map((r) => r.filePath))];

          // Get conversation history for context
          let conversationContext = "";
          if (chatId) {
            conversationContext = await getRecentChatHistoryForContext(
              chatId,
              4,
            );
          }

          systemPrompt = buildCodebaseSystemPrompt(
            project.projectName,
            formattedContext,
            projectStats,
          );

          if (
            conversationContext &&
            conversationContext !== "No previous conversation."
          ) {
            systemPrompt += `\n\nPREVIOUS CONVERSATION:\n${conversationContext}`;
          }
        } else {
          systemPrompt = `You are GitVision AI. The project "${project?.projectName ?? "Unknown"}" has not been fully indexed yet (status: ${project?.embeddingStatus ?? "unknown"}). 
Please let the user know that embeddings need to be generated before codebase-aware chat can work. 
You can still answer general programming questions.`;
        }
      } catch (ragError) {
        console.error("RAG retrieval error:", ragError);
        // Fall back to general mode
      }
    }

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages,
      onFinish: async ({ text }) => {
        // Store AI response
        if (chatId) {
          await db.insert(chatMessages).values({
            chatId,
            role: "assistant",
            content: text,
            relatedFiles: relatedFiles.length > 0 ? relatedFiles : [],
            createdAt: new Date(),
          });

          // Update chat timestamp
          await db
            .update(projectChats)
            .set({ updatedAt: new Date() })
            .where(eq(projectChats.id, chatId));

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
            const title = userMessage.slice(0, 80).trim();
            await db
              .update(projectChats)
              .set({ title })
              .where(eq(projectChats.id, chatId));
          }
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
