import { NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle";
import { projectTables, userProjectsTable, commitsTable, projectFiles } from "@/drizzle/schema/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const SenderUserId = searchParams.get("userId");

    // Get the authenticated user from the Clerk session
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to access your projects." },
        { status: 401 }
      );
    }

    if (SenderUserId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized. You can only access your own projects." },
        { status: 403 }
      );
    }

    // Find projects where the user is the owner
    const ownedProjects = await db
      .select()
      .from(projectTables)
      .where(eq(projectTables.ownerId, userId));

    // Find projects where the user is a collaborator
    const collaborativeProjects = await db
      .select({
        project: projectTables,
      })
      .from(projectTables)
      .innerJoin(
        userProjectsTable,
        and(
          eq(userProjectsTable.projectId, projectTables.id),
          eq(userProjectsTable.userId, userId)
        )
      )
      .orderBy(desc(projectTables.createdAt));

    // Extract the project data from collaborative projects
    const collaborationProjects = collaborativeProjects.map(
      (item) => item.project
    );

    // Combine both sets of projects (removing duplicates by ID)
    const allProjects = [...ownedProjects];

    // Add collaboration projects that aren't already included (to avoid duplicates)
    collaborationProjects.forEach((project) => {
      if (!allProjects.some((p) => p.id === project.id)) {
        allProjects.push(project);
      }
    });

    // Sort by creation date (newest first)
    allProjects.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Get additional data for each project
    const formattedProjects = await Promise.all(
      allProjects.map(async (project) => {
        // Get commit count
        const commitResult = await db
          .select({ count: count() })
          .from(commitsTable)
          .where(eq(commitsTable.projectId, project.id));
        
        const commitsCount = commitResult[0]?.count || 0;
        
        // Get file count
        const fileResult = await db
          .select({ count: count() })
          .from(projectFiles)
          .where(eq(projectFiles.projectId, project.id));
        
        const filesCount = fileResult[0]?.count || 0;

        return {
          id: project.id,
          name: project.projectName,
          githubUrl: project.githubUrl,
          ownerId: project.ownerId,
          commitsCount: commitsCount,
          filesCount: filesCount,
          stars: project.star || 0,
          forks: project.forks || 0,
          branches: project.totalBranches || 0,
          contributors: project.totalContributors || 0,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };
      })
    );

    // Return the formatted projects
    return NextResponse.json(
      { message: "Projects retrieved successfully", projects: formattedProjects },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching user projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
