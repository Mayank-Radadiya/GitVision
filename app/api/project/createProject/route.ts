import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createNewProject, syncIssuesAndComments } from "@/src/lib/github";
import { projectCreateSchema } from "@/src/lib/validation/schemas";
import { rateLimit, keys } from "@/src/lib/rate-limit";

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

    // Per-user cap on heavy GitHub-backed project creation (10/hour)
    const rl = await rateLimit(keys.projectCreate(userId), 10, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Project creation limit reached. Please try again later.",
        },
        { status: 429 },
      );
    }

    // Validate body against the strict schema (github.com-only URLs)
    const parsed = projectCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { projectName, repoUrl } = parsed.data;

    // Create project + fetch metadata + initial 100 commits via GraphQL
    const { projectId } = await createNewProject(repoUrl, projectName, userId);

    // Fetch issues/PRs + comments via GraphQL in background
    syncIssuesAndComments(repoUrl, projectId).catch((error) => {
      console.error("Error fetching issues in background:", error);
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
