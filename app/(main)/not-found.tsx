import { FolderX, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MainNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-6 bg-card/60 border border-border/40 p-8 rounded-2xl backdrop-blur-xl shadow-lg">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted text-muted-foreground">
          <FolderX className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Resource Not Found
          </h2>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t find the project or chat session you were looking for.
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-md cursor-pointer"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
