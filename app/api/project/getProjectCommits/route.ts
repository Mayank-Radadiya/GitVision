import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { commitsTable } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { assertProjectOwnership, ProjectAccessError } from "@/src/lib/guards";
import { projectIdSchema } from "@/src/lib/validation/schemas";
import { logger } from "@/src/lib/logger";

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectIdRaw = searchParams.get("projectId");
    const limitRaw = parseInt(searchParams.get("limit") || "10", 10);
    const pageRaw = parseInt(searchParams.get("page") || "1", 10);

    const parsedProject = projectIdSchema.safeParse({ projectId: projectIdRaw });
    if (!parsedProject.success) {
      return NextResponse.json(
        { error: parsedProject.error.issues[0]?.message ?? "Invalid or missing project ID" },
        { status: 400 },
      );
    }

    const { projectId } = parsedProject.data;
    const limit = isNaN(limitRaw) || limitRaw < 1 ? 10 : Math.min(limitRaw, 100);
    const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

    // Tenant isolation: 404 if the project isn't owned by this user
    await assertProjectOwnership(projectId, userId);

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Fetch commits + count in parallel
    const [commits, countRows] = await Promise.all([
      db
        .select()
        .from(commitsTable)
        .where(eq(commitsTable.projectId, projectId))
        .orderBy(desc(commitsTable.authorDate))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(commitsTable)
        .where(eq(commitsTable.projectId, projectId)),
    ]);

    const total = countRows[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      commits: commits.map((commit) => ({
        id: commit.id,
        commitHash: commit.commitHash,
        commitMessage: commit.commitMessage,
        AiSummary: commit.AiSummary,
        authorName: commit.authorName,
        authorEmail: commit.authorEmail,
        authorAvatar: commit.authorAvatar,
        authorDate: commit.authorDate.toISOString(),
        committerName: commit.committerName,
        committerEmail: commit.committerEmail,
        committerDate: commit.committerDate.toISOString(),
        projectId: commit.projectId,
        createdAt: commit.createdAt.toISOString(),
      })),
      pagination: {
        totalPages,
        total,
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    logger.error("Error fetching project commits:", error, { requestId });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
