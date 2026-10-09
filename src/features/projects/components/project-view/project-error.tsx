"use client";

/**
 * Project Error Boundary — Full-page error state with retry.
 * Replaces both ErrorState.tsx and ErrorNotification.tsx.
 * Uses react-hot-toast for transient errors (via parent).
 */

import { memo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface ProjectErrorProps {
  message: string | null;
  onRetry: () => void;
  pending?: boolean;
}

function ProjectError({ message, onRetry, pending }: ProjectErrorProps) {
  const router = useRouter();

  return (
    <div className="project-workspace bg-background min-h-screen p-4 pt-16 md:p-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard")}
        className="text-muted-foreground hover:text-foreground group mb-8 cursor-pointer gap-2"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
        Back to projects
      </Button>

      {/* Error Card */}
      <div className="bg-card border-border mx-auto max-w-lg rounded-xl border px-6 py-10 text-center sm:p-10">
        <div className="bg-destructive/10 mb-5 inline-flex rounded-lg p-3">
          <AlertCircle className="text-destructive size-6" />
        </div>

        <h1 className="text-foreground mb-3 text-xl font-semibold tracking-tight">
          Couldn’t load this project
        </h1>

        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
          {message ||
            "An unexpected error occurred. Please try again or return to the dashboard."}
        </p>

        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={pending}
            className="cursor-pointer gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
            {pending ? "Retrying…" : "Try again"}
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            className="cursor-pointer gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(ProjectError);
