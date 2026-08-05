import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
    logger.error("Error fetching project details:", error, { requestId });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
