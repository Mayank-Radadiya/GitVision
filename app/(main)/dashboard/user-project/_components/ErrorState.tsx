"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo } from "react";

interface ErrorStateProps {
  errorText: string | null;
  onRetry: () => void;
}

const ErrorState = ({ errorText, onRetry }: ErrorStateProps) => {
  const router = useRouter();

  return (
    <div className="space-y-8 p-8 bg-gradient-to-b from-background to-background/70">
      <div className="max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 hover:bg-background/80 group"
            onClick={() => router.push("/dashboard")}
          >
            <ExternalLink className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Button>
        </div>

        <Card className="border border-red-300/20 p-8 text-center bg-card/50 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="p-4 rounded-full bg-red-500/10">
              <ExternalLink className="h-12 w-12 text-red-500/80" />
            </div>
            <h2 className="text-xl font-medium">Error Loading Project</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {errorText || "An error occurred while loading the project data."}
            </p>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try Again
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => router.push("/dashboard")}
              >
                Return to Dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default memo(ErrorState);
