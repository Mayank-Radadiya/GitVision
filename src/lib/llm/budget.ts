/**
 * Central token/context budget manager.
 * Single source of truth for context sizing, allocations, and fit-to-budget truncation.
 */

export interface BudgetAllocation {
  model: string;
  contextWindow: number;
  instructions: number;
  output: number;
  history: number;
  context: number;
}

export interface BudgetableItem {
  approxTokens: number;
}

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "gemini-flash-latest": 1_048_576,
  "gemini-1.5-flash": 1_048_576,
  "claude-3-5-sonnet": 200_000,
  "gpt-4o": 128_000,
  default: 128_000,
};

/**
 * Fast token count estimator using ~4 characters per token ratio.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Computes token allocation budgets for a given model.
 */
export function computeBudget(
  modelId: string = "gemini-flash-latest",
  customMaxOutput?: number,
): BudgetAllocation {
  const contextWindow =
    MODEL_CONTEXT_WINDOWS[modelId] ?? MODEL_CONTEXT_WINDOWS["default"];
  const output = customMaxOutput ?? 2048;
  const instructions = 1500;
  const remaining = Math.max(0, contextWindow - output - instructions);

  return {
    model: modelId,
    contextWindow,
    instructions,
    output,
    history: Math.floor(remaining * 0.25),
    context: Math.floor(remaining * 0.75),
  };
}

/**
 * Fits a list of budgetable items into a budget, returning included items and truncation status.
 */
export function fitToBudget<T extends BudgetableItem>(
  items: T[],
  budgetTokens: number,
): { included: T[]; truncated: boolean; usedTokens: number } {
  let usedTokens = 0;
  const included: T[] = [];
  for (const item of items) {
    if (usedTokens + item.approxTokens > budgetTokens) {
      return { included, truncated: true, usedTokens };
    }
    included.push(item);
    usedTokens += item.approxTokens;
  }
  return { included, truncated: false, usedTokens };
}
