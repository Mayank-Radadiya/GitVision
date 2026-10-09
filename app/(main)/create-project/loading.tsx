/**
 * Create Project — Loading Skeleton
 *
 * Matches the single-column layout: back link, header, URL field, and preset
 * pills. Nothing below the URL field renders until it parses, so the skeleton
 * stops there too.
 */

export default function Loading() {
  return (
    <div className="gv-page relative min-h-screen overflow-hidden">
      <div className="bg-grid-small-black dark:bg-grid-small-white pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative mx-auto w-full max-w-[600px] px-5 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 h-4 w-28 rounded bg-gv-hairline/60 animate-pulse" />

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="h-6 w-44 rounded-full bg-gv-hairline/60 animate-pulse" />
            <div className="space-y-2">
              <div className="h-8 w-64 rounded-lg bg-gv-hairline/70 animate-pulse" />
              <div className="h-4 w-5/6 rounded bg-gv-hairline/40 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="h-4 w-24 rounded bg-gv-hairline/50 animate-pulse" />
            <div className="h-12 w-full rounded-xl bg-gv-graphite-2 animate-pulse" />
            <div className="h-3 w-56 rounded bg-gv-hairline/30 animate-pulse" />
          </div>

          <div className="space-y-3">
            <div className="h-3 w-28 rounded bg-gv-hairline/30 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-8 w-24 rounded-full bg-gv-graphite-2 animate-pulse" />
              <div className="h-8 w-28 rounded-full bg-gv-graphite-2 animate-pulse" />
              <div className="h-8 w-32 rounded-full bg-gv-graphite-2 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}