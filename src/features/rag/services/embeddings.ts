/**
 * Embedding generation service using Google Gemini
 * Generates vector embeddings for code chunks and queries
 */

import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequestsPerMinute: 60,
  minDelayMs: 1000, // Minimum 1 second between requests
};

let lastRequestTime = 0;

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply rate limiting before making API calls
 */
async function applyRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT.minDelayMs) {
    const delay = RATE_LIMIT.minDelayMs - timeSinceLastRequest;
    await sleep(delay);
  }

  lastRequestTime = Date.now();
}

/**
 * Generate embedding for a single text chunk
 * Uses Gemini embedding-004 model with 768 dimensions
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    await applyRateLimit();

    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

    const result = await model.embedContent({
      content: { role: "user", parts: [{ text }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT, // Optimized for code/documentation
    });

    const embedding = result.embedding.values;

    // Validate embedding dimensions
    if (embedding.length !== 768) {
      throw new Error(`Expected 768 dimensions, got ${embedding.length}`);
    }

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Generate embedding for a search query
 * Uses RETRIEVAL_QUERY task type for better search performance
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    await applyRateLimit();

    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

    const result = await model.embedContent({
      content: { role: "user", parts: [{ text: query }] },
      taskType: TaskType.RETRIEVAL_QUERY, // Optimized for search queries
    });

    const embedding = result.embedding.values;

    if (embedding.length !== 768) {
      throw new Error(`Expected 768 dimensions, got ${embedding.length}`);
    }

    return embedding;
  } catch (error) {
    console.error("Error generating query embedding:", error);
    throw new Error(
      `Failed to generate query embedding: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Generate embeddings for multiple chunks in batches
 * Handles rate limiting automatically
 */
export async function generateEmbeddingsBatch(
  chunks: Array<{ content: string; index: number }>,
): Promise<Array<{ embedding: number[]; index: number }>> {
  const results: Array<{ embedding: number[]; index: number }> = [];
  const errors: Array<{ index: number; error: Error }> = [];

  // Process in batches to respect rate limits
  const batchSize = 5; // Process 5 at a time

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    // Process batch concurrently
    const batchPromises = batch.map(async (chunk) => {
      try {
        const embedding = await generateEmbedding(chunk.content);
        return { embedding, index: chunk.index };
      } catch (error) {
        errors.push({
          index: chunk.index,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Filter out failed embeddings
    for (const result of batchResults) {
      if (result) {
        results.push(result);
      }
    }

    // Add delay between batches
    if (i + batchSize < chunks.length) {
      await sleep(2000); // 2 second delay between batches
    }
  }

  // Log errors if any
  if (errors.length > 0) {
    console.warn(
      `Failed to generate ${errors.length} embeddings out of ${chunks.length}`,
    );
    for (const err of errors) {
      console.warn(`  - Chunk ${err.index}: ${err.error.message}`);
    }
  }

  return results;
}

/**
 * Preprocess code content before embedding
 * Adds context to help the model understand the code better
 */
export function preprocessCodeForEmbedding(
  code: string,
  filePath: string,
  chunkType: string,
): string {
  const language = filePath.split(".").pop()?.toLowerCase() || "unknown";

  // Add file context as a comment
  const context = `// File: ${filePath}
// Language: ${language}
// Type: ${chunkType}

`;

  return context + code;
}
