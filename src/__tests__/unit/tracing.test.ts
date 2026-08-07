import { describe, it, expect, vi } from "vitest";
import { RequestTracer } from "@/src/lib/llm/tracing";
import { logger } from "@/src/lib/logger";

describe("RequestTracer Service", () => {
  it("should generate a request ID if none is provided", () => {
    const tracer = new RequestTracer();
    expect(tracer.requestId).toBeDefined();
    expect(tracer.requestId.length).toBeGreaterThan(0);
  });

  it("should preserve provided request ID", () => {
    const tracer = new RequestTracer("test-request-123");
    expect(tracer.requestId).toBe("test-request-123");
  });

  it("should record stage execution time", async () => {
    const tracer = new RequestTracer();
    const result = await tracer.timeStage("test_stage", async () => {
      return 42;
    });

    expect(result).toBe(42);
    const stages = tracer.getStages();
    expect(stages).toHaveLength(1);
    expect(stages[0].name).toBe("test_stage");
    expect(stages[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should emit chat.turn structured log summary", async () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const tracer = new RequestTracer("req-abc");

    await tracer.timeStage("search", async () => "ok");

    tracer.logTurnSummary({
      chatId: "chat-1",
      projectId: "proj-1",
      retrievalPath: "rag",
      hitCount: 5,
      meanSimilarity: 0.85,
    });

    expect(spy).toHaveBeenCalledWith(
      "chat.turn",
      expect.objectContaining({
        requestId: "req-abc",
        chatId: "chat-1",
        projectId: "proj-1",
        retrievalPath: "rag",
        hitCount: 5,
        meanSimilarity: 0.85,
        stageLatenciesMs: expect.objectContaining({
          search: expect.any(Number),
        }),
        totalLatencyMs: expect.any(Number),
      }),
    );

    spy.mockRestore();
  });
});
