import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { eq } from "drizzle-orm";

async function resetStuckProjects() {
  const result = await db
    .update(projectTables)
    .set({
      embeddingStatus: "pending",
      embeddingProgress: 0,
      embeddingError: null,
    })
    .where(eq(projectTables.embeddingStatus, "processing"))
    .returning({ id: projectTables.id, name: projectTables.projectName });

  console.log("Reset projects:", JSON.stringify(result, null, 2));
  process.exit(0);
}

resetStuckProjects().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
