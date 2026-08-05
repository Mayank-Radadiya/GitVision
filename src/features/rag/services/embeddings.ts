/**
 * Embedding generation service using OpenRouter SDK
 * Generates vector embeddings for code chunks and queries
 * Model: qwen/qwen3-embedding-8b (768 dimensions for DB compatibility)
 */

import { OpenRouter } from "@openrouter/sdk";

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY environment variable is required");
}

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";
const EMBEDDING_DIMENSIONS = 768;

// Rate limiting configuration (OpenRouter has higher limits than Gemini free tier)
const RATE_LIMIT = {
  minDelayMs: 200, // 200ms between requests
};

let lastRequestTime = 0;

// Serializes rate-limit enforcement. A plain read-then-sleep-then-write raced:
// concurrent callers (e.g. the 5-in-parallel batches in generateEmbeddingsBatch)
// all read the same lastRequestTime, slept the same amount, then fired together.
// Chaining on a promise makes the check-and-update atomic.
let rateLimitQueue: Promise<void> = Promise.resolve();

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply rate limiting before making API calls.
 * Callers await the previous caller's delay before measuring — so concurrent
 * calls are spaced RATE_LIMIT.minDelayMs apart instead of bursting.
 */
function applyRateLimit(): Promise<void> {
  const run = rateLimitQueue.then(async () => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT.minDelayMs) {
      await sleep(RATE_LIMIT.minDelayMs - timeSinceLastRequest);
    }

    lastRequestTime = Date.now();
  });
  // Keep the chain alive even if one link rejects.
  rateLimitQueue = run.catch(() => {});
  return run;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  await applyRateLimit();

  const result = await openrouter.embeddings.generate({
    requestBody: {
      model: EMBEDDING_MODEL,
      input: text,
      encodingFormat: "float",
      dimensions: EMBEDDING_DIMENSIONS,
    },
  });

  if (typeof result === "string") {
    throw new Error(`Unexpected string response from OpenRouter: ${result}`);
  }

  const embeddingData = result.data[0].embedding;

  if (!Array.isArray(embeddingData)) {
    throw new Error("Expected float array embedding, got string (base64)");
  }

  if (embeddingData.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embeddingData.length}`,
    );
  }

  return embeddingData;
}

export const generateQueryEmbedding = generateEmbedding;

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
      await sleep(100);
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
