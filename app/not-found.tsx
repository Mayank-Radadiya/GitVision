import { FileQuestion, ArrowLeft, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full text-center space-y-6 bg-card/60 border border-border/40 p-8 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground font-mono">
            404
          </h1>
          <h2 className="text-lg font-semibold text-foreground">
            Page Not Found
          </h2>
          <p className="text-sm text-muted-foreground">
            The page or repository analysis you are looking for doesn&apos;t exist or may have moved.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-md cursor-pointer"
            aria-label="Go to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/60 bg-background hover:bg-muted text-foreground font-medium text-sm transition-colors cursor-pointer"
            aria-label="Go to Home"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
