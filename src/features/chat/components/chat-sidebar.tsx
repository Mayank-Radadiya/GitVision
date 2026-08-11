"use client";

import {
  Plus,
  MessageSquare,
  Trash2,
  FolderGit2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/src/shared/components/ui/button";
import { ScrollArea } from "@/src/shared/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/shared/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

interface Chat {
  id: string;
  title: string;
  type: string;
  projectId: string | null;
  updatedAt: Date;
}

interface ChatSidebarProps {
  chats: Chat[];
  activeChatId?: string;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

export function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: ChatSidebarProps) {
  const generalChats = chats.filter((c) => c.type === "general");
  const projectChats = chats.filter((c) => c.type === "project");

  return (
    <div className="border-border/40 bg-background/60 flex h-full w-64 flex-col border-r backdrop-blur-sm">
      {/* Header */}
      <div className="border-border/40 flex items-center justify-between border-b p-4">
        <h2 className="text-foreground/80 text-sm font-semibold">Chats</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onNewChat}
                variant="ghost"
                size="icon"
                aria-label="Start new chat"
                className="h-7 w-7 rounded-lg"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Chat list */}
      <ScrollArea className="flex-1 px-2 py-2">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="text-muted-foreground/40 mb-3 h-8 w-8" />
            <p className="text-muted-foreground/60 text-sm">No chats yet</p>
            <p className="text-muted-foreground/40 mt-1 text-xs">
              Start a conversation
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* General chats */}
            {generalChats.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 px-2">
                  <Sparkles className="text-muted-foreground/50 h-3 w-3" />
                  <span className="text-muted-foreground/50 text-[10px] font-medium tracking-wider uppercase">
                    General
                  </span>
                </div>
                <div className="space-y-0.5">
                  {generalChats.map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      onSelect={() => onSelectChat(chat.id)}
                      onDelete={() => onDeleteChat(chat.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Project chats */}
            {projectChats.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 px-2">
                  <FolderGit2 className="text-muted-foreground/50 h-3 w-3" />
                  <span className="text-muted-foreground/50 text-[10px] font-medium tracking-wider uppercase">
                    Projects
                  </span>
                </div>
                <div className="space-y-0.5">
                  {projectChats.map((chat) => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      onSelect={() => onSelectChat(chat.id)}
                      onDelete={() => onDeleteChat(chat.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ChatListItem({
  chat,
  isActive,
  onSelect,
  onDelete,
}: {
  chat: Chat;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{chat.title}</p>
        <p className="text-[10px] opacity-60">
          {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete chat conversation"
        className="hover:bg-destructive/10 hover:text-destructive shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </button>
  );
}
