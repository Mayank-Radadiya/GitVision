import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Reset stuck "processing" projects — scoped to the requesting user's own
// projects only (previously reset every project in the system).
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await db
      .update(projectTables)
      .set({
        embeddingStatus: "pending",
        embeddingProgress: 0,
        embeddingError: null,
      })
      .where(
        and(
          eq(projectTables.embeddingStatus, "processing"),
          eq(projectTables.ownerId, userId), // ← tenant isolation
        ),
      )
      .returning({
        id: projectTables.id,
        name: projectTables.projectName,
      });

    return NextResponse.json({
      message: `Reset ${result.length} stuck projects`,
      projects: result,
    });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
