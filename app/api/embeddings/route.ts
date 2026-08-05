import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projectTables, codeEmbeddings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { processProjectForRag } from "@/src/features/rag/services/rag-ingestion";
import { assertProjectOwnership, ProjectAccessError } from "@/src/lib/guards";
import { rateLimit, keys } from "@/src/lib/rate-limit";

// Store active generation promises to prevent GC.
// ponytail: module-level Map is per-instance only — reliable dedupe would
// need a DB lock; the DB status field already prevents duplicate work.
const activeGenerations = new Map<string, Promise<unknown>>();

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Per-user cap on Gemini-backed embedding generation (5/10min)
    const rl = await rateLimit(keys.embeddings(userId), 5, 600);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Embedding generation limit reached. Please wait." },
        { status: 429 },
      );
    }

    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 },
      );
    }

    // Tenant isolation: 404 if the project isn't owned by this user
    const project = await assertProjectOwnership(projectId, userId);

    if (
      project.embeddingStatus === "processing" ||
      activeGenerations.has(projectId)
    ) {
      return NextResponse.json(
        { error: "Embeddings are already being generated" },
        { status: 409 },
      );
    }

    // Safety check: if status is "completed" but no embeddings actually exist,
    // reset status to allow re-generation (fixes the green-dot-but-empty-DB bug)
    if (project.embeddingStatus === "completed") {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(codeEmbeddings)
        .where(eq(codeEmbeddings.projectId, projectId));

      if ((countResult?.count ?? 0) === 0) {
        console.warn(
          `[Embeddings] Project ${projectId} marked as completed but has 0 embeddings — resetting to pending`,
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

    const generationPromise = processProjectForRag(projectId)
      .then((result) => {
        console.log(
          `✅ Embeddings done for ${projectId}: ${result.totalEmbeddings} embeddings, ${result.processedFiles} files`,
        );
        activeGenerations.delete(projectId);
      })
      .catch((error) => {
        console.error(
          `❌ Embedding generation failed for ${projectId}:`,
          error,
        );
        activeGenerations.delete(projectId);
      });

    activeGenerations.set(projectId, generationPromise);

    return NextResponse.json({ status: "started" });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Embedding API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 },
      );
    }

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
        });
      }
    }

    return NextResponse.json({
      status: project.embeddingStatus,
      progress: project.embeddingProgress,
      error: project.embeddingError,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Embedding status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE — Cancel / Reset a stuck embedding generation
 */
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 },
      );
    }

    // Tenant isolation: 404 if the project isn't owned by this user
    await assertProjectOwnership(projectId, userId);

    // Remove from active generations map
    activeGenerations.delete(projectId);

    // Reset DB status back to pending
    await db
      .update(projectTables)
      .set({
        embeddingStatus: "pending",
        embeddingProgress: 0,
        embeddingError: null,
        updatedAt: new Date(),
      })
      .where(eq(projectTables.id, projectId));

    console.log(`🛑 Embedding generation cancelled for ${projectId}`);

    return NextResponse.json({ status: "cancelled" });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Embedding cancel error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
