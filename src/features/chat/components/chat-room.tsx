"use client";

import { useState } from "react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface ChatRoomProps {
  chatId: string;
  projectId?: string;
  projectName?: string;
  type: "project" | "general";
  title: string;
}

export function ChatRoom({
  chatId,
  projectId,
  projectName,
  type,
  title,
}: ChatRoomProps) {
  const router = useRouter();
  const [messages] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/chat")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {projectName && (
              <p className="text-sm text-muted-foreground">
                Project: {projectName}
              </p>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <Card className="p-6 min-h-[600px] flex flex-col">
          <div className="flex-1 mb-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">
                    Chat feature is being rebuilt
                  </p>
                  <p className="text-sm">Chat ID: {chatId}</p>
                  <p className="text-sm">Type: {type}</p>
                  {projectId && (
                    <p className="text-sm">Project ID: {projectId}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className="p-4 bg-muted rounded-lg">
                    {msg}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input Area (Disabled for now) */}
          <div className="border-t pt-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Chat feature coming soon..."
                disabled
                className="flex-1 px-4 py-2 border rounded-lg bg-muted/50 cursor-not-allowed"
              />
              <Button disabled>Send</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
