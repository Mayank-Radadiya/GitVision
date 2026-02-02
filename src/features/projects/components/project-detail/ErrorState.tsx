"use client";

import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo } from "react";

interface ErrorStateProps {
  errorText: string | null;
  onRetry: () => void;
}

const ErrorState = ({ errorText, onRetry }: ErrorStateProps) => {
  const router = useRouter();

  return (
    <div className="space-y-8 p-8 bg-gradient-to-b from-background to-background/70 min-h-screen">
      <div className="max-w-screen-2xl mx-auto">
        {/* Back Button */}
        <div className="flex items-center gap-2 mb-8">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 hover:bg-background/80 group transition-all duration-200 cursor-pointer font-[family-name:var(--font-fira-sans)]"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
            Back to Dashboard
          </Button>
        </div>

        {/* Enhanced Error Card */}
        <Card className="border border-red-300/30 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-xl overflow-hidden relative">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(239,68,68,0.05),transparent_50%)]" />

          {/* Content */}
          <div className="relative z-10 p-12 text-center">
            <div className="flex flex-col items-center justify-center gap-6 max-w-2xl mx-auto">
              {/* Icon */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-red-500/15 to-red-500/5 ring-2 ring-red-500/20">
                <AlertCircle className="h-16 w-16 text-red-500" />
              </div>

              {/* Title */}
              <h2 className="text-3xl font-bold font-[family-name:var(--font-fira-code)] text-foreground">
                Error Loading Project
              </h2>

              {/* Description */}
              <p className="text-base text-muted-foreground leading-relaxed font-[family-name:var(--font-fira-sans)]">
                {errorText ||
                  "An unexpected error occurred while loading the project data. Please try again or return to the dashboard."}
              </p>

              {/* Actions */}
              <div className="flex gap-4 mt-4">
                <Button
                  variant="outline"
                  size="default"
                  onClick={onRetry}
                  className="gap-2 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 cursor-pointer font-[family-name:var(--font-fira-sans)]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  size="default"
                  onClick={() => router.push("/dashboard")}
                  className="gap-2 bg-gradient-to-br from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#F97316] border-0 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer font-[family-name:var(--font-fira-sans)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Return to Dashboard
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom Border Accent */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
        </Card>
      </div>
    </div>
  );
};

export default memo(ErrorState);
