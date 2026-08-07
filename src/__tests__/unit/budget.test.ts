import { describe, it, expect } from "vitest";
import {
  computeBudget,
  estimateTokens,
  fitToBudget,
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
    expect(budget.contextWindow).toBe(MODEL_CONTEXT_WINDOWS["gemini-flash-latest"]);
    expect(budget.output).toBe(2048);
    expect(budget.instructions).toBe(1500);
    const expectedRemaining = budget.contextWindow - 2048 - 1500;
    expect(budget.history).toBe(Math.floor(expectedRemaining * 0.25));
    expect(budget.context).toBe(Math.floor(expectedRemaining * 0.75));
  });

  it("should fall back to default window for unknown model ID", () => {
    const budget = computeBudget("unknown-model");
    expect(budget.contextWindow).toBe(MODEL_CONTEXT_WINDOWS["default"]);
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
