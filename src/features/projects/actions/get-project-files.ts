import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projectTables, projectFiles } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

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

    // Get the authenticated user from the Clerk session
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to access project files." },
        { status: 401 }
      );
    }

    // Check if user has access to the project (as owner or collaborator)
    const hasAccess = await db
      .select({ id: projectTables.id })
      .from(projectTables)
      .where(
        and(
          eq(projectTables.id, projectId),
          or(eq(projectTables.ownerId, userId))
        )
      )
      .limit(1);

    if (hasAccess.length === 0) {
      return NextResponse.json(
        { error: "You don't have access to this project" },
        { status: 403 }
      );
    }

    // Get project files
    const files = await db
      .select({
        id: projectFiles.id,
        fileName: projectFiles.fileName,
        code: projectFiles.code,
        createdAt: projectFiles.createdAt,
        updatedAt: projectFiles.updatedAt,
      })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));

    // Format the files for Sandpack
    const sandpackFiles = files.reduce((acc, file) => {
      acc[file.fileName] = {
        code: file.code,
        readOnly: true,
      };
      return acc;
    }, {} as Record<string, { code: string; readOnly: boolean }>);

    // Return the files
    return NextResponse.json(
      {
        message: "Project files retrieved successfully",
        files: files,
        sandpackFiles: sandpackFiles,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching project files:", error);
    return NextResponse.json(
      { error: "Failed to fetch project files" },
      { status: 500 }
    );
  }
}
