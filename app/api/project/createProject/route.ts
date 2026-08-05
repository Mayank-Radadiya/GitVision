import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createNewProject } from "@/src/lib/github";
import { projectCreateSchema } from "@/src/lib/validation/schemas";
import { rateLimit, keys } from "@/src/lib/rate-limit";
import { inngest } from "@/src/lib/inngest/client";
import { logger } from "@/src/lib/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
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

    // Validate body against the strict schema (github.com-only URLs with validators.githubUrl)
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

    const cleanUrl = repoUrl.endsWith(".git")
      ? repoUrl.slice(0, -4)
      : repoUrl;
    const parts = cleanUrl.trim().split("/");
    const owner = parts[parts.length - 2]!;
    const repo = parts[parts.length - 1]!;

    // Dispatch durable Inngest event for background issue & comment syncing
    try {
      await inngest.send({
        name: "project/created",
        data: {
          projectId,
          repoUrl,
          owner,
          repo,
        },
      });
    } catch (inngestError) {
      logger.error(
        "Failed to dispatch Inngest project/created event",
        inngestError,
        { requestId, projectId },
      );
      // Non-fatal for client response as project is created, but recorded in logs
    }

    logger.info("Project created successfully", {
      requestId,
      userId,
      projectId,
    });

    return NextResponse.json({
      success: true,
      projectId,
      message: "Project created successfully",
    });
  } catch (error) {
    logger.error("Error creating project:", error, { requestId });

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
