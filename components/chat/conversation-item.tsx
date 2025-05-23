import { cn } from "@/lib/utils";
import { MessageSquare, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { memo } from "react";

interface ConversationItemProps {
  conversation: {
    id: string;
    title: string;
    date: string;
    unread: boolean;
  };
}

function ConversationItem({ conversation }: ConversationItemProps) {
  return (
    <div
      className={cn(
        "flex flex-col p-2.5 rounded-md cursor-pointer group transition-colors",
        conversation.unread ? "bg-muted/80 hover:bg-muted" : "hover:bg-muted/50"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2 min-w-0">
          <MessageSquare
            className={cn(
              "h-4 w-4 mt-0.5 flex-shrink-0",
              conversation.unread ? "text-primary" : "text-muted-foreground"
            )}
          />
          <div className="min-w-0">
            <h4
              className={cn(
                "text-sm truncate",
                conversation.unread ? "font-medium" : ""
              )}
            >
              {conversation.title}
            </h4>
            <span className="text-xs text-muted-foreground block">
              {conversation.date}
            </span>
          </div>
        </div>

        <div className="ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(ConversationItem);
