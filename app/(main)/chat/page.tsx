import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchAllUserProject } from "@/action/project/project.action";

export default async function ChatPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch user's projects
  const projects = await fetchAllUserProject(userId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Chat Feature</h1>
        <p className="text-muted-foreground">Chat feature is being rebuilt</p>
        <p className="text-sm text-muted-foreground mt-2">
          Found {projects.length} projects
        </p>
      </div>
    </div>
  );
}
