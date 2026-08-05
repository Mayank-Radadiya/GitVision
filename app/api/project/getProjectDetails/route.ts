import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { assertProjectOwnership, ProjectAccessError } from "@/src/lib/guards";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    // Tenant isolation: 404 if the project isn't owned by this user
    const project = await assertProjectOwnership(projectId, userId);

    return NextResponse.json({
      project: {
        id: project.id,
        projectName: project.projectName,
        githubUrl: project.githubUrl,
        star: project.star,
        forks: project.forks,
        totalCommits: project.totalCommits,
        totalBranches: project.totalBranches,
        totalContributors: project.totalContributors,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        ownerId: project.ownerId,
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error fetching project details:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
