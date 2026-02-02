import { NextRequest, NextResponse } from "next/server";
import { repositoryZodSchema } from "@/features/projects/schemas/repository.schema";
import {
  createNewProject,
  getCommitHashes,
  getRepositoryFiles,
} from "@/src/lib/github";
import { auth } from "@clerk/nextjs/server";

// This API route handles the creation of a new project
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
    // Validate the request body using Zod schema
    const validationResult = repositoryZodSchema.safeParse(body);

    // If validation fails, return error response
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors },
        { status: 400 }
      );
    }

    // Extract validated data
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

    // store commit hashes and files in the database without await
    getCommitHashes(repoUrl, projectId);
    // get files from the repository and store them in the database
    // This function should be called without await to avoid blocking
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
