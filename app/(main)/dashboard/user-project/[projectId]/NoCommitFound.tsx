"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GitCommit } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo } from "react";

const NoCommitFound = () => {
  const router = useRouter();
  return (
    <>
      {" "}
      <Card className="border border-border/40 p-8 text-center bg-card/50 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center gap-4">
          <GitCommit className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">
            No commits found for this project.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => router.push("/dashboard")}
          >
            Return to Dashboard
          </Button>
        </div>
      </Card>{" "}
    </>
  );
};

export default memo(NoCommitFound);
