import { NextRequest, NextResponse } from "next/server";
import { getUserProjects } from "@/action/project/userProjects.action";

/**
 * GET handler for fetching user projects
 * @param request The incoming request
 * @returns The response with user projects
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const userProjects = await getUserProjects(userId);

    return NextResponse.json(userProjects);
  } catch (error) {
    console.error("Error in getUserProjects API:", error);
    return NextResponse.json(
      { error: "Failed to fetch user projects" },
      { status: 500 }
    );
  }
}
