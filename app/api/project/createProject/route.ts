import { NextRequest, NextResponse } from "next/server";
import { repositoryZodSchema } from "@/zodSchema/repository.schema";
import { createNewProject, getRepositoryFiles } from "@/lib/github";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = repositoryZodSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { ProjectName, repoUrl } = validationResult.data;

    // Use the createNewProject function from lib/github.ts
    const { projectId } = await createNewProject(repoUrl, ProjectName, userId);

    // Extract owner and repo from GitHub URL to get files
    const cleanUrl = repoUrl.endsWith(".git") ? repoUrl.slice(0, -4) : repoUrl;
    const [owner, repo] = cleanUrl.split("/").slice(-2);

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format" },
        { status: 400 }
      );
    }

    // Get repository files and store them in the database
    getRepositoryFiles(owner, repo, projectId);

    // Return success response with project details
    return NextResponse.json({
      success: true,
      message: "Project created successfully",
    });
  } catch (error) {
    console.error("Error in create project API:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
