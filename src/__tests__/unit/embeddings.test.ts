import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getOpenRouterClient,
  preprocessCodeForEmbedding,
} from "@/src/features/rag/services/embeddings";

describe("OpenRouter Embeddings Service", () => {
  const originalEnv = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.OPENROUTER_API_KEY = originalEnv;
    }
  });

  it("should lazy load OpenRouter client and throw error when OPENROUTER_API_KEY is missing upon invocation", () => {
    expect(() => getOpenRouterClient()).toThrow(
      "OPENROUTER_API_KEY environment variable is required",
    );
  });

  it("should return OpenRouter client instance when OPENROUTER_API_KEY is set", () => {
    process.env.OPENROUTER_API_KEY = "sk-test-key";
    const client = getOpenRouterClient();
    expect(client).toBeDefined();
  });

  it("should correctly format code for embedding", () => {
    const code = "console.log('hello');";
    const filePath = "src/index.ts";
    const chunkType = "code";

    const formatted = preprocessCodeForEmbedding(code, filePath, chunkType);
    expect(formatted).toContain("// File: src/index.ts");
    expect(formatted).toContain("// Language: ts");
    expect(formatted).toContain("// Type: code");
    expect(formatted).toContain("console.log('hello');");
  });
});
