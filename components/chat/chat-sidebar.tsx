import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlusCircle, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ConversationItem from "./conversation-item";
import { memo } from "react";

const recentConversations = [
  { id: "1", title: "React Performance Tips", date: "Today", unread: true },
  {
    id: "2",
    title: "Database Schema Design",
    date: "Yesterday",
    unread: false,
  },
  { id: "3", title: "API Authentication", date: "2 days ago", unread: false },
  { id: "4", title: "CSS Grid Layout", date: "3 days ago", unread: false },
  { id: "5", title: "State Management", date: "1 week ago", unread: false },
  { id: "6", title: "Next.js Routing", date: "2 weeks ago", unread: false },
  { id: "7", title: "TypeScript Tips", date: "3 weeks ago", unread: false },
];

interface ChatSidebarProps {
  isVisible: boolean;
  onClose: () => void;
}

function ChatSidebar({ isVisible, onClose }: ChatSidebarProps) {
  return (
    <div
      className={`fixed top-0 right-0 h-full max-h-screen w-80 bg-background/95 backdrop-blur-sm border-l shadow-lg transition-transform duration-300 ease-in-out z-30 ${
        isVisible ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <Card className="h-full rounded-none border-0">
        <div className="p-4  h-11 flex justify-between items-center">
          <h2 className="font-semibold text-lg">Conversations</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-4 pt-1 pl-48">
          <Button
            variant="ghost"
            className="w-full justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted"
          >
            <PlusCircle className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-160px)]">
          <div className="p-2 space-y-1">
            {recentConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
              />
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}

export default memo(ChatSidebar);
