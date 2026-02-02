import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const project = await db
      .select()
      .from(projectTables)
      .where(eq(projectTables.id, projectId))
      .limit(1);

    if (!project || project.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      project: {
        id: project[0].id,
        projectName: project[0].projectName,
        githubUrl: project[0].githubUrl,
        star: project[0].star,
        forks: project[0].forks,
        totalCommits: project[0].totalCommits,
        totalBranches: project[0].totalBranches,
        totalContributors: project[0].totalContributors,
        createdAt: project[0].createdAt.toISOString(),
        updatedAt: project[0].updatedAt.toISOString(),
        ownerId: project[0].ownerId,
      },
    });
  } catch (error) {
    console.error("Error fetching project details:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
