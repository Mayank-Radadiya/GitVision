"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090b] text-foreground flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full text-center space-y-6 bg-card/80 border border-border/40 p-8 rounded-2xl backdrop-blur-xl shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 text-destructive mb-2">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              A critical system error occurred. We have logged the issue and are working to resolve it.
            </p>
            {error.digest && (
              <p className="text-xs font-mono text-muted-foreground/60 pt-1">
                Error Code: {error.digest}
              </p>
            )}
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 cursor-pointer"
              aria-label="Try reloading application"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
