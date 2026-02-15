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
}

function ProjectError({ message, onRetry }: ProjectErrorProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/dashboard")}
        className="gap-2 text-muted-foreground hover:text-foreground group cursor-pointer mb-8"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
        Back to Dashboard
      </Button>

      {/* Error Card */}
      <div className="mx-auto max-w-lg rounded-2xl border border-red-500/20 bg-card/80 backdrop-blur-xl p-12 text-center shadow-xl">
        <div className="mb-6 inline-flex rounded-2xl bg-red-500/10 p-4">
          <AlertCircle className="h-12 w-12 text-red-400" />
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-3">
          Error Loading Project
        </h2>

        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          {message ||
            "An unexpected error occurred. Please try again or return to the dashboard."}
        </p>

        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={onRetry}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            className="gap-2 bg-gradient-to-br from-[#F97316] to-[#EA580C] border-0 text-white cursor-pointer"
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
