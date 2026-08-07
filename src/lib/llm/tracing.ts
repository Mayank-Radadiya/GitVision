/**
 * Request-scoped tracer and latency instrumentation module.
 */

import { logger } from "@/src/lib/logger";

export interface StageMetrics {
  name: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export class RequestTracer {
  public readonly requestId: string;
  public readonly startTime: number;
  private stages: StageMetrics[] = [];

  constructor(requestId?: string) {
    this.requestId = requestId || crypto.randomUUID();
    this.startTime = performance.now();
  }

  /**
   * Executes an async operation, recording its duration and optional metadata metrics.
   */
  public async timeStage<T>(
    name: string,
    fn: () => Promise<T>,
    metadataExtractor?: (result: T) => Record<string, unknown>,
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const durationMs = Math.round(performance.now() - start);
      const metadata = metadataExtractor ? metadataExtractor(result) : undefined;
      this.stages.push({ name, durationMs, metadata });
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      this.stages.push({ name, durationMs, metadata: { error: String(error) } });
      throw error;
    }
  }

  /**
   * Returns a copy of all recorded stage metrics.
   */
  public getStages(): StageMetrics[] {
    return [...this.stages];
  }

  /**
   * Emits a single structured log entry for the completed turn summary.
   */
  public logTurnSummary(summary: {
    chatId?: string;
    projectId?: string;
    retrievalPath: "rag" | "small-dump" | "not-indexed";
    hitCount?: number;
    meanSimilarity?: number;
    inputTokens?: number;
    outputTokens?: number;
  }): void {
    const totalLatencyMs = Math.round(performance.now() - this.startTime);
    const stageLatenciesMs: Record<string, number> = {};
    for (const stage of this.stages) {
      stageLatenciesMs[stage.name] = stage.durationMs;
    }

    logger.info("chat.turn", {
      requestId: this.requestId,
      ...summary,
      stageLatenciesMs,
      totalLatencyMs,
    });
  }
}
