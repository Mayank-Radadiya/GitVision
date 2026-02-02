import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { commitsTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const limit = parseInt(searchParams.get("limit") || "10");
    const page = parseInt(searchParams.get("page") || "1");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Fetch commits with pagination
    const commits = await db
      .select()
      .from(commitsTable)
      .where(eq(commitsTable.projectId, projectId))
      .orderBy(desc(commitsTable.authorDate))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalCommits = await db
      .select()
      .from(commitsTable)
      .where(eq(commitsTable.projectId, projectId));

    const total = totalCommits.length;
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
    console.error("Error fetching project commits:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
