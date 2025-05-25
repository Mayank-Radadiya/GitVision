import { LucideIcon } from "lucide-react";
import { Button } from "../ui/button";
import { memo } from "react";

interface SuggestedPromptProps {
  title: string;
  prompt: string;
  icon: LucideIcon;
  onClick: () => void;
}

function SuggestedPrompt({
  title,
  prompt,
  icon: Icon,
  onClick,
}: SuggestedPromptProps) {
  return (
    <Button
      variant="outline"
      className="flex flex-col items-start h-24 p-4 border-muted/50 bg-background shadow-sm hover:bg-muted/10 hover:border-primary/20 transition-all"
      onClick={onClick}
    >
      <div className="flex flex-col justify-between h-full">
        <div className="flex items-center mb-1 text-primary">
          <Icon className="h-4 w-4 mr-2" />
          <span className="font-medium">{title}</span>
        </div>
        <p className="text-sm text-muted-foreground whitespace-normal break-words">
          {prompt}
        </p>
      </div>
    </Button>
  );
}

export default memo(SuggestedPrompt);
