import { describe, it, expect, vi } from "vitest";

const warnings: string[] = [];
vi.mock("@/src/lib/logger", () => ({
  logger: {
    warn: (message: string) => warnings.push(message),
    info: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  },
}));

import {
  computeBudget,
  estimateTokens,
  fitToBudget,
  MAX_CONTEXT_TOKENS,
  MODEL_CONTEXT_WINDOWS,
} from "@/src/lib/llm/budget";

describe("Budget Manager Primitive", () => {
  it("should estimate tokens based on character count ratio", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("12345678")).toBe(2);
  });

  it("should compute dynamic budget allocation for gemini-flash-latest", () => {
    const budget = computeBudget("gemini-flash-latest");
    expect(budget.contextWindow).toBe(
      MODEL_CONTEXT_WINDOWS["gemini-flash-latest"],
    );
    expect(budget.output).toBe(2048);
    expect(budget.instructions).toBe(1500);
    const expectedRemaining = budget.contextWindow - 2048 - 1500;
    expect(budget.history).toBe(Math.floor(expectedRemaining * 0.25));
    expect(budget.context).toBe(
      Math.min(Math.floor(expectedRemaining * 0.75), MAX_CONTEXT_TOKENS),
    );
  });

  it("caps context at MAX_CONTEXT_TOKENS even when the window is huge", () => {
    // 1M-token window minus output/instructions leaves ~783k of "context",
    // which fitToBudget never trims against. The ceiling is what makes the
    // budget real.
    expect(computeBudget("gemini-flash-latest").context).toBe(MAX_CONTEXT_TOKENS);
    expect(computeBudget("gpt-4o").context).toBe(MAX_CONTEXT_TOKENS);
  });

  it("falls back to the default window for an unknown model ID and says so", () => {
    warnings.length = 0;
    const budget = computeBudget("unknown-model");
    expect(budget.contextWindow).toBe(MODEL_CONTEXT_WINDOWS["default"]);
    expect(warnings.join("\n")).toContain("unknown-model");
  });

  it("should fit items into budget and truncate when limit is exceeded", () => {
    const items = [
      { id: 1, approxTokens: 100 },
      { id: 2, approxTokens: 200 },
      { id: 3, approxTokens: 300 },
    ];

    const result = fitToBudget(items, 350);
    expect(result.truncated).toBe(true);
    expect(result.included).toEqual([
      { id: 1, approxTokens: 100 },
      { id: 2, approxTokens: 200 },
    ]);
    expect(result.usedTokens).toBe(300);
  });

  it("should return all items untruncated when budget is sufficient", () => {
    const items = [
      { id: 1, approxTokens: 100 },
      { id: 2, approxTokens: 200 },
    ];

    const result = fitToBudget(items, 500);
    expect(result.truncated).toBe(false);
    expect(result.included).toHaveLength(2);
    expect(result.usedTokens).toBe(300);
  });
});
