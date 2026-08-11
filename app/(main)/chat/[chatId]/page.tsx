import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { caller } from "@/src/lib/trpc/server";
import { db } from "@/db";
import { projectTables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ChatRoom } from "@/src/features/chat/components/chat-room";

interface ChatPageProps {
  params: Promise<{ chatId: string }>;
}

export default async function ChatDetailPage({ params }: ChatPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { chatId } = await params;

  let chatData;
  try {
    chatData = await caller.chat.getById({ chatId });
  } catch {
    notFound();
  }

  // Get project name if this is a project chat
  let projectName: string | undefined;
  if (chatData.projectId) {
    const [project] = await db
      .select({ projectName: projectTables.projectName })
      .from(projectTables)
      .where(eq(projectTables.id, chatData.projectId))
      .limit(1);
    projectName = project?.projectName;
  }

  return (
    <div className="h-screen bg-linear-to-br from-background via-background/95 to-background/90">
      <ChatRoom
        chatId={chatData.id}
        projectId={chatData.projectId}
        projectName={projectName}
        type={chatData.type as "project" | "general"}
        title={chatData.title}
        initialMessages={chatData.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
          relatedFiles: m.relatedFiles as string[] | undefined,
          createdAt: m.createdAt,
        }))}
      />
    </div>
  );
}
