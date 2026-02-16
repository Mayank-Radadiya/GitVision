import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { caller } from "@/src/lib/trpc/server";
import { ChatLanding } from "@/src/features/chat/components/chat-landing";

export default async function ChatPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [projects, chats] = await Promise.all([
    caller.project.getAll(),
    caller.chat.getAll(),
  ]);

  return (
    <ChatLanding
      projects={projects.map((p) => ({
        id: p.id,
        name: p.projectName,
        embeddingStatus: p.embeddingStatus ?? "pending",
      }))}
      chats={chats.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        projectId: c.projectId,
        updatedAt: c.updatedAt,
      }))}
    />
  );
}
