/**
 * Chat history management for RAG conversations
 * Stores and retrieves chat messages with project context
 */

import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { estimateTokens, fitToBudget } from "@/src/lib/llm/budget";

/**
 * Get recent messages for LLM context (last N messages)
 * Formatted for the system prompt
 *
 * @param chatId - Chat ID
 * @param limit - Number of recent messages (default: 6)
 * @param maxTokens - Optional token budget for message history
 * @returns Formatted chat history string
 */
export async function getRecentChatHistoryForContext(
  chatId: string,
  limit: number = 6,
  maxTokens?: number,
): Promise<string> {
  try {
    const messages = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
      })
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    if (messages.length === 0) {
      return "No previous conversation.";
    }

    // Reverse to get chronological order
    const chronologicalMessages = messages.reverse();

    // Format as conversation items
    let items = chronologicalMessages.map((msg) => {
      const roleLabel =
        msg.role === "user"
          ? "User"
          : msg.role === "assistant"
            ? "Assistant"
            : "System";
      const text = `${roleLabel}: ${msg.content}`;
      return { text, approxTokens: estimateTokens(text) };
    });

    if (maxTokens !== undefined && maxTokens > 0) {
      const fit = fitToBudget(items, maxTokens);
      items = fit.included;
    }

    if (items.length === 0) {
      return "No previous conversation.";
    }

    return items.map((i) => i.text).join("\n\n");
  } catch (error) {
    console.error("Error getting recent chat history:", error);
    return "Error retrieving chat history.";
  }
}
