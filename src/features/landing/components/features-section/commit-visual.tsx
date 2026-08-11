export function CommitVisual() {
  return (
    <div className="border-border/30 bg-muted/30 text-muted-foreground mt-6 overflow-hidden rounded-lg border p-3 font-mono text-xs">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-foreground/70">main</span>
        <span className="text-muted-foreground/50">←</span>
        <span className="text-blue-400">feature/auth</span>
      </div>
      <div className="space-y-1 text-[11px]">
        <div>
          <span className="text-green-400">+ 47</span>{" "}
          <span className="text-red-400">- 12</span>{" "}
          <span className="text-muted-foreground/60">auth.ts</span>
        </div>
        <div>
          <span className="text-green-400">+ 8</span>{" "}
          <span className="text-red-400">- 2</span>{" "}
          <span className="text-muted-foreground/60">middleware.ts</span>
        </div>
        <div className="text-primary/70 pt-1">
          AI: &quot;Adds JWT auth with refresh tokens&quot;
        </div>
      </div>
    </div>
  );
}
