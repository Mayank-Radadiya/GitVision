import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { caller } from "@/src/lib/trpc/server";
import { ChatRoom } from "@/src/features/chat/components/chat-room";

interface ChatPageProps {
  params: Promise<{ chatId: string }>;
  searchParams: Promise<{ file?: string }>;
}

export default async function ChatDetailPage({
  params,
  searchParams,
}: ChatPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { chatId } = await params;
  // F-09: the code viewer's "Ask About This File" lands here. Read on the
  // server so no client component consumes search params (no Suspense needed).
  const { file } = await searchParams;

  let chatData;
  try {
    chatData = await caller.chat.getById({ chatId });
  } catch {
    notFound();
  }

  return (
    <div className="h-screen bg-linear-to-br from-background via-background/95 to-background/90">
      <ChatRoom
        chatId={chatData.id}
        projectId={chatData.projectId}
        // Joined in by chat.getById — no second query needed for the name.
        projectName={chatData.projectName ?? undefined}
        // Also joined in / parsed by chat.getById, for the F-03 starter chips.
        projectLanguages={chatData.languages}
        projectDependencies={chatData.dependencies}
        // F-09: pre-fills the input with a file inquiry when arriving from
        // the code viewer's "Ask About This File" button.
        initialFilePath={file}
        type={chatData.type as "project" | "general"}
        title={chatData.title}
        // ponytail: only the newest 300 messages load. Longer chats start
        // mid-conversation for the model. Add a "load earlier" control that
        // pages getById by cursor if that ever matters.
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
