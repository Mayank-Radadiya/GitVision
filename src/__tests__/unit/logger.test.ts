import { describe, it, expect, vi } from "vitest";
import { logger } from "@/src/lib/logger";

describe("Logger Service", () => {
  it("should output structured info log without throwing", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("Test log message", { key: "value" });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should output structured error log without throwing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("Test error message", { error: "something failed" });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
