import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertProjectOwnership, ProjectAccessError } from "@/src/lib/guards";
import { enforceLimits } from "@/src/lib/rate-limit";
import { projectIdSchema } from "@/src/lib/validation/schemas";
import { logger } from "@/src/lib/logger";
import { isTerminalStatus, sseFrame, toProgressEvent } from "@/src/lib/embedding-progress";

/**
 * A stream that outlives a single request needs its own runtime guarantees:
 * `force-dynamic` so Next never tries to evaluate it at build time, and the
 * Node runtime because the tick loop is a plain `setInterval`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** How often the projects row is re-read. The UI used to poll at 2s; the bar moves in 5-file batches, so 1.5s is responsive without being a busy loop. */
const TICK_MS = 1_500;

/** Proxy idle timeouts sit between 15s and 60s. A comment frame well under the lower bound keeps the socket warm without adding events. */
const PING_EVERY_MS = 15_000;

/**
 * Backstop so an abandoned tab cannot hold a serverless invocation open
 * indefinitely. Vercel kills the function at `maxDuration` regardless; this
 * just makes the close deliberate instead of a severed connection.
 */
const MAX_STREAM_MS = 5 * 60_000;

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || undefined;
  let projectId: string | undefined;
  let userId: string | undefined;

  try {
    const authResult = await auth();
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = authResult.userId;

    // One read of the budget per *connection*, not per tick — a single stream
    // legitimately polls many times and should not be charged for each one.
    const rl = await enforceLimits("embeddingsRead", userId, req);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Embedding status limit reached. Please wait." },
        { status: 429 },
      );
    }

    const parsed = projectIdSchema.safeParse({
      projectId: new URL(req.url).searchParams.get("projectId"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid or missing project ID" },
        { status: 400 },
      );
    }

    projectId = parsed.data.projectId;
    // The 404 exists here for the same reason it exists on the REST route:
    // a foreign project id must be indistinguishable from a missing one.
    await assertProjectOwnership(projectId, userId);
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("[EmbeddingProgress] failed to open stream", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let lastPayload: string | null = null;
      let ticksSincePing = 0;
      let closed = false;
      // Declared before `close` so the cleanup path can cancel it; an
      // uncleared timer keeps the Node event loop alive and, on serverless,
      // holds the invocation open past the last byte written.
      let timer: ReturnType<typeof setInterval> | undefined;
      let maxDurationTimer: ReturnType<typeof setTimeout> | undefined;
      const onAbort = () => close();

      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        if (maxDurationTimer) clearTimeout(maxDurationTimer);
        req.signal.removeEventListener("abort", onAbort);
        // A client that navigated away aborts `req.signal`; the fetch rejects on
        // its own, but a timer that fires into a dead controller throws.
        if (req.signal.aborted) {
          controller.error(new Error("client disconnected"));
          return;
        }
        try {
          controller.close();
        } catch {
          // Already closed by the runtime — nothing to do.
        }
      };

      const tick = async () => {
        if (closed) return;
        try {
          const rows = await db
            .select({
              status: projectTables.embeddingStatus,
              percentage: projectTables.embeddingProgress,
              indexedFileCount: projectTables.indexedFileCount,
              totalFileCount: projectTables.totalFileCount,
              error: projectTables.embeddingError,
            })
            .from(projectTables)
            .where(eq(projectTables.id, projectId))
            .limit(1);

          const row = rows[0];
          if (!row) {
            // The project was deleted mid-stream. Stop rather than spin.
            close();
            return;
          }

          const event = toProgressEvent(row, row.error);
          const payload = JSON.stringify(event);
          ticksSincePing = 0;

          if (payload !== lastPayload) {
            lastPayload = payload;
            controller.enqueue(encoder.encode(sseFrame(event)));
          }

          if (isTerminalStatus(event.status)) close();
        } catch (error) {
          logger.error("[EmbeddingProgress] stream tick failed", {
            requestId,
            projectId,
            error: error instanceof Error ? error.message : String(error),
          });
          close();
        }
      };

      timer = setInterval(() => {
        if (closed) return;
        if (++ticksSincePing * TICK_MS >= PING_EVERY_MS) {
          ticksSincePing = 0;
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            close();
            return;
          }
        }
        void tick();
      }, TICK_MS);

      // Send the first frame immediately so the client has something to render
      // before the first interval boundary.
      void tick();

      maxDurationTimer = setTimeout(close, MAX_STREAM_MS);
      req.signal.addEventListener("abort", onAbort, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx and several CDNs buffer responses by default, which would
      // defeat the point of streaming.
      "X-Accel-Buffering": "no",
    },
  });
}
