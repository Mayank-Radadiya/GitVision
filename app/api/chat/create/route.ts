import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createChat, createGeneralChat } from "@/lib/chat-history";

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { type, projectId, title } = body;

    if (!type || !["project", "general"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid chat type. Must be 'project' or 'general'" },
        { status: 400 }
      );
    }

    let chatId: string;

    if (type === "project") {
      if (!projectId) {
        return NextResponse.json(
          { error: "Project ID is required for project chats" },
          { status: 400 }
        );
      }
      chatId = await createChat(projectId, userId, title);
    } else {
      // General chat
      chatId = await createGeneralChat(userId, title);
    }

    return NextResponse.json({
      success: true,
      chatId,
      type,
    });

  } catch (error) {
    console.error("Error creating chat:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 }
    );
  }
}
