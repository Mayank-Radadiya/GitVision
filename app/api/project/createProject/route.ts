import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createNewProject, getCommitHashes } from "@/src/lib/github";

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - User not authenticated" },
        { status: 401 },
      );
    }

    // Parse request body
    const body = await req.json();
    const { ProjectName, repoUrl } = body;

    // Validate inputs
    if (
      !ProjectName ||
      typeof ProjectName !== "string" ||
      ProjectName.trim() === ""
    ) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 },
      );
    }

    if (!repoUrl || typeof repoUrl !== "string" || repoUrl.trim() === "") {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 },
      );
    }

    // Create project in database with GitHub data
    const { projectId } = await createNewProject(
      repoUrl.trim(),
      ProjectName.trim(),
      userId,
    );

    // Fetch and store commits in background (don't await - run async)
    getCommitHashes(repoUrl.trim(), projectId).catch((error) => {
      console.error("Error fetching commits in background:", error);
    });

    return NextResponse.json({
      success: true,
      projectId,
      message: "Project created successfully",
    });
  } catch (error) {
    console.error("Error creating project:", error);

    // Handle specific error types from github.ts
    if (error instanceof Error) {
      const gitHubError = error as { statusCode?: number; code?: string };

      if (gitHubError.code === "GITHUB_VALIDATION_ERROR") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (gitHubError.code === "GITHUB_NOT_FOUND") {
        return NextResponse.json(
          { error: "GitHub repository not found" },
          { status: 404 },
        );
      }

      if (gitHubError.code === "GITHUB_RATE_LIMIT") {
        return NextResponse.json(
          { error: "GitHub API rate limit exceeded. Please try again later." },
          { status: 429 },
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "Failed to create project. Please check the repository URL and try again.",
      },
      { status: 500 },
    );
  }
}
