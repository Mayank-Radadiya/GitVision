"use client";

import { Button } from "@/components/ui/button";
import { FolderGit2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

const NoProjectFoundCred = () => {
  const router = useRouter();
  return (
    <>
      {" "}
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-background rounded-2xl border border-dashed border-muted-foreground/30 p-8 sm:p-10 shadow-sm transition-all hover:border-muted-foreground/50">
        {/* Icon with Glow Ring */}
        <div className="mb-8 relative flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/20 to-purple-400/20 blur-xl rounded-full scale-110" />
          <div className="relative z-10 p-5 bg-white/50 dark:bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center">
            <FolderGit2 className="h-14 w-14 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
        </div>

        {/* Heading */}
        <h3 className="text-2xl font-bold tracking-tight mb-2 text-center">
          Ready to Analyze Your Code?
        </h3>

        {/* Description */}
        <p className="text-muted-foreground text-center max-w-md mb-8 leading-relaxed text-sm sm:text-base">
          Connect a repository to unlock commit history, collaboration patterns,
          and productivity insights.
        </p>

        {/* Buttons */}
        <div className="flex flex-col w-[300px] relative">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/create-project")}
            className="group  w-full gap-2 transition-all hover:shadow-md active:scale-[0.98]"
            aria-label="Connect a new repository (Recommended)"
          >
            <div className="flex items-center gap-2 flex-1">
              <Plus className="h-4 w-4 transition-transform group-hover:scale-110 group-active:scale-95 shrink-0" />
              <span className="truncate">Connect Repository</span>
            </div>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-purple-400 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md font-medium backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50">
              Recommended
            </span>
          </Button>
        </div>
      </div>{" "}
    </>
  );
};

export default NoProjectFoundCred;
