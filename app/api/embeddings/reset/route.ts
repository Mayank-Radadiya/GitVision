import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { eq } from "drizzle-orm";

// Temporary endpoint to reset stuck "processing" projects
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
      .where(eq(projectTables.embeddingStatus, "processing"))
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
