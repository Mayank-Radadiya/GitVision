import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projectFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
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

    // Tenant isolation: 404 if the project isn't owned by this user.
    // This route returns full source code — must never leak cross-tenant.
    await assertProjectOwnership(projectId, userId);

    // Fetch all files for the project
    const files = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));

    // Transform files to Sandpack format
    // Sandpack expects: { "/path/to/file.js": { code: "content" } }
    const sandpackFiles: Record<string, { code: string }> = {};

    if (files && files.length > 0) {
      for (const file of files) {
        // Ensure path starts with /
        const filePath = file.fileName.startsWith("/")
          ? file.fileName
          : `/${file.fileName}`;

        sandpackFiles[filePath] = {
          code: file.code,
        };
      }
    } else {
      // Return a helpful placeholder file when no files exist
      sandpackFiles["/README.md"] = {
        code: `# Project Files Not Yet Processed\n\nThis project's files are being processed. Please check back in a few moments.\n\nIf this message persists, the project may not have been fully imported from GitHub.`,
      };
    }

    return NextResponse.json({
      sandpackFiles,
      totalFiles: files?.length || 0,
      message:
        files?.length === 0
          ? "No files found - showing placeholder"
          : undefined,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error fetching project files:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
