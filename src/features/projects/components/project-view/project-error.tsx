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
        className="text-muted-foreground hover:text-foreground group mb-8 cursor-pointer gap-2"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
        Back to Dashboard
      </Button>

      {/* Error Card */}
      <div className="bg-card/80 mx-auto max-w-lg rounded-2xl border border-red-500/20 p-12 text-center shadow-xl backdrop-blur-xl">
        <div className="mb-6 inline-flex rounded-2xl bg-red-500/10 p-4">
          <AlertCircle className="h-12 w-12 text-red-400" />
        </div>

        <h2 className="text-foreground mb-3 text-2xl font-bold">
          Error Loading Project
        </h2>

        <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
          {message ||
            "An unexpected error occurred. Please try again or return to the dashboard."}
        </p>

        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={onRetry}
            className="cursor-pointer gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            className="cursor-pointer gap-2 border-0 bg-linear-to-br from-[#F97316] to-[#EA580C] text-white"
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
