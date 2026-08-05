export interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message,
        ...context,
      }),
    );
  },

  warn(message: string, context?: LogContext) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "WARN",
        message,
        ...context,
      }),
    );
  },

  error(message: string, error?: unknown, context?: LogContext) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        message,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
        ...context,
      }),
    );
  },

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "DEBUG",
          message,
          ...context,
        }),
      );
    }
  },
};
