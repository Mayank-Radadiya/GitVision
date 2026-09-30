import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projectTables, codeEmbeddings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { assertProjectOwnership, ProjectAccessError } from "@/src/lib/guards";
import { enforceLimits } from "@/src/lib/rate-limit";
import { inngest } from "@/src/lib/inngest/client";
import { projectIdSchema } from "@/src/lib/validation/schemas";
import { logger } from "@/src/lib/logger";

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Per-user cap on OpenRouter-backed embedding generation (5/10min), plus an
    // IP ceiling and the global daily backstop — see rate-limit.ts.
    const rl = await enforceLimits("embeddings", userId, req);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Embedding generation limit reached. Please wait." },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = projectIdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid or missing project ID" },
        { status: 400 },
      );
    }

    const { projectId } = parsed.data;

    // Tenant isolation: 404 if the project isn't owned by this user
    const project = await assertProjectOwnership(projectId, userId);

    if (project.embeddingStatus === "processing") {
      return NextResponse.json(
        { error: "Embeddings are already being generated" },
        { status: 409 },
      );
    }

    // Safety check: if status is "completed" but no embeddings actually exist,
    // reset status to allow re-generation
    if (project.embeddingStatus === "completed") {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(codeEmbeddings)
        .where(eq(codeEmbeddings.projectId, projectId));

      if ((countResult?.count ?? 0) === 0) {
        logger.warn(
          `[Embeddings] Project ${projectId} marked as completed but has 0 embeddings — resetting to pending`,
          { requestId, projectId },
        );
        await db
          .update(projectTables)
          .set({
            embeddingStatus: "pending",
            embeddingProgress: 0,
            embeddingError: null,
            updatedAt: new Date(),
          })
          .where(eq(projectTables.id, projectId));
      }
    }

    try {
      await inngest.send({
        name: "embeddings/generate",
        data: { projectId },
      });
    } catch (error) {
      logger.error("Failed to queue embedding generation:", error, { requestId, projectId });
      return NextResponse.json(
        { error: "Failed to queue embedding generation" },
        { status: 500 },
      );
    }

    logger.info(`Embedding generation queued for ${projectId}`, { requestId, projectId });
    return NextResponse.json({ status: "started" });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("Embedding API error:", error, { requestId });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Status polling (30/min per user, plus the IP ceiling and the global daily
    // backstop) — see rate-limit.ts. Pass `req` so the IP dimension is actually
    // reachable; without it a fresh Clerk account escapes the cost ceiling.
    const rl = await enforceLimits("embeddingsRead", userId, req);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Embedding status limit reached. Please wait." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(req.url);
    const projectIdRaw = searchParams.get("projectId");
    const parsed = projectIdSchema.safeParse({ projectId: projectIdRaw });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid or missing project ID" },
        { status: 400 },
      );
    }

    const { projectId } = parsed.data;

    // Tenant isolation: 404 if the project isn't owned by this user
    const project = await assertProjectOwnership(projectId, userId);

    // Auto-correct: if marked as "completed" but no embeddings exist, reset to "pending"
    if (project.embeddingStatus === "completed") {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(codeEmbeddings)
        .where(eq(codeEmbeddings.projectId, projectId));

      if ((countResult?.count ?? 0) === 0) {
        await db
          .update(projectTables)
          .set({
            embeddingStatus: "pending",
            embeddingProgress: 0,
            embeddingError: null,
            updatedAt: new Date(),
          })
          .where(eq(projectTables.id, projectId));

        return NextResponse.json({
          status: "pending",
          progress: 0,
          error: null,
          indexedFileCount: 0,
          totalFileCount: 0,
        });
      }
    }

    return NextResponse.json({
      status: project.embeddingStatus,
      progress: project.embeddingProgress,
      error: project.embeddingError,
      // Live counters, so a client that missed the SSE stream (or never opened
      // one) still renders "N of M" instead of parsing the error prose.
      indexedFileCount: project.indexedFileCount,
      totalFileCount: project.totalFileCount,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("Embedding status error:", error, { requestId });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cancellation shares the `embeddings` budget (5/10min per user, 40/10min per
    // address) with POST on purpose: both mutate embedding state, and two
    // separate counters would be one more allowance to burn through.
    const rl = await enforceLimits("embeddings", userId, req);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Embedding generation limit reached. Please wait." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(req.url);
    const projectIdRaw = searchParams.get("projectId");
    const parsed = projectIdSchema.safeParse({ projectId: projectIdRaw });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid or missing project ID" },
        { status: 400 },
      );
    }

    const { projectId } = parsed.data;

    // Tenant isolation: 404 if the project isn't owned by this user
    await assertProjectOwnership(projectId, userId);

    // Cancel any running Inngest function, then reset status for a retry
    try {
      await inngest.send({
        name: "embeddings/cancel",
        data: { projectId },
      });
    } catch (error) {
      logger.error("Failed to send embeddings/cancel event:", error, { requestId, projectId });
    }

    await db
      .update(projectTables)
      .set({
        embeddingStatus: "pending",
        embeddingProgress: 0,
        embeddingError: null,
        updatedAt: new Date(),
      })
      .where(eq(projectTables.id, projectId));

    logger.info(`Embedding generation cancelled for ${projectId}`, { requestId, projectId });

    return NextResponse.json({ status: "cancelled" });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("Embedding cancel error:", error, { requestId });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
