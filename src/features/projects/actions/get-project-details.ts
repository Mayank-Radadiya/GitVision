import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET handler for retrieving project details by ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Fetch project by id
    const project = await db
      .select()
      .from(projectTables)
      .where(eq(projectTables.id, projectId))
      .limit(1);

    if (!project || project.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const formattedProject = {
      ...project[0],
      createdAt: project[0].createdAt.toISOString(),
      updatedAt: project[0].updatedAt.toISOString(),
    };

    return NextResponse.json(
      {
        message: "Project details retrieved successfully",
        project: formattedProject,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching project details:", error);
    return NextResponse.json(
      { error: "Failed to fetch project details" },
      { status: 500 }
    );
  }
}
