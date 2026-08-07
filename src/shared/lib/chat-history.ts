/**
 * Chat history management for RAG conversations
 * Stores and retrieves chat messages with project context
 */

import { db } from "@/db";
import { projectChats, chatMessages } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { estimateTokens, fitToBudget } from "@/src/lib/llm/budget";

export interface Message {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  relatedFiles?: string[];
  createdAt?: Date;
}

/**
 * Get chat history for a specific chat
 *
 * @param chatId - Chat ID
 * @param limit - Maximum number of messages to retrieve (default: 50)
 * @returns Array of messages
 */
export async function getChatHistory(
  chatId: string,
  limit: number = 50,
): Promise<Message[]> {
  try {
    const messages = await db
      .select({
        id: chatMessages.id,
        role: chatMessages.role,
        content: chatMessages.content,
        relatedFiles: chatMessages.relatedFiles,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    // Reverse to get chronological order (oldest first) and cast types properly
    return messages.reverse().map((msg) => ({
      ...msg,
      role: msg.role as "user" | "assistant" | "system",
      relatedFiles: msg.relatedFiles as string[] | undefined,
    }));
  } catch (error) {
    console.error("Error getting chat history:", error);
    throw new Error(
      `Failed to get chat history: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
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

/**
 * Store a message in the chat history
 *
 * @param chatId - Chat ID
 * @param role - Message role (user, assistant, system)
 * @param content - Message content
 * @param relatedFiles - Optional array of related file paths
 * @returns Message ID
 */
export async function storeMessage(
  chatId: string,
  role: "user" | "assistant" | "system",
  content: string,
  relatedFiles?: string[],
): Promise<string> {
  try {
    const [message] = await db
      .insert(chatMessages)
      .values({
        chatId,
        role,
        content,
        relatedFiles: relatedFiles || [],
        createdAt: new Date(),
      })
      .returning();

    // Update chat's updated_at timestamp
    await db
      .update(projectChats)
      .set({ updatedAt: new Date() })
      .where(eq(projectChats.id, chatId));

    return message.id;
  } catch (error) {
    console.error("Error storing message:", error);
    throw new Error(
      `Failed to store message: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get all chats for a user and project
 *
 * @param userId - User ID
 * @param projectId - Project ID
 * @returns Array of chats
 */
export async function getUserProjectChats(
  userId: string,
  projectId: string,
): Promise<
  Array<{ id: string; title: string; createdAt: Date; updatedAt: Date }>
> {
  try {
    const chats = await db
      .select({
        id: projectChats.id,
        title: projectChats.title,
        createdAt: projectChats.createdAt,
        updatedAt: projectChats.updatedAt,
      })
      .from(projectChats)
      .where(
        and(
          eq(projectChats.userId, userId),
          eq(projectChats.projectId, projectId),
        ),
      )
      .orderBy(desc(projectChats.updatedAt));

    return chats;
  } catch (error) {
    console.error("Error getting user project chats:", error);
    throw new Error(
      `Failed to get chats: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Update chat title
 *
 * @param chatId - Chat ID
 * @param title - New title
 */
export async function updateChatTitle(
  chatId: string,
  title: string,
): Promise<void> {
  try {
    await db
      .update(projectChats)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(eq(projectChats.id, chatId));
  } catch (error) {
    console.error("Error updating chat title:", error);
    throw new Error(
      `Failed to update chat title: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Delete a chat and all its messages
 *
 * @param chatId - Chat ID
 */
export async function deleteChat(chatId: string): Promise<void> {
  try {
    // Messages will be deleted automatically via CASCADE
    await db.delete(projectChats).where(eq(projectChats.id, chatId));
  } catch (error) {
    console.error("Error deleting chat:", error);
    throw new Error(
      `Failed to delete chat: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Verify user has access to a chat
 *
 * @param chatId - Chat ID
 * @param userId - User ID
 * @returns Boolean indicating access
 */
export async function verifyChatAccess(
  chatId: string,
  userId: string,
): Promise<boolean> {
  try {
    const chat = await db
      .select({ userId: projectChats.userId })
      .from(projectChats)
      .where(eq(projectChats.id, chatId))
      .limit(1);

    return chat.length > 0 && chat[0].userId === userId;
  } catch (error) {
    console.error("Error verifying chat access:", error);
    return false;
  }
}
