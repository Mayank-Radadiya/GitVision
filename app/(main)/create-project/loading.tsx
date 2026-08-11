/**
 * Create Project — Branded Loading Skeleton
 *
 * Quiet dark-page skeleton that mirrors the dual-pane form layout.
 */

export default function Loading() {
  return (
    <div className="gv-page min-h-screen">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-14">
        {/* Back link placeholder */}
        <div className="h-4 w-24 rounded bg-gv-hairline/70 animate-pulse" />

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-8">
          {/* Left — form card skeleton */}
          <div className="lg:col-span-7">
            <div className="gv-card space-y-5 p-6 sm:p-8">
              <div className="h-9 w-3/5 rounded bg-gv-hairline/70 animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-gv-hairline/50 animate-pulse" />

              <div className="mt-10 space-y-6">
                <div className="h-11 w-full rounded-lg bg-gv-graphite-2 animate-pulse" />
                <div className="h-11 w-full rounded-lg bg-gv-graphite-2 animate-pulse" />
                <div className="h-12 w-full rounded-xl bg-gv-graphite-2 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Right — preview rail skeleton */}
          <div className="hidden lg:col-span-5 lg:block">
            <div className="gv-card space-y-4 p-6">
              <div className="h-4 w-1/3 rounded bg-gv-hairline/70 animate-pulse" />
              <div className="h-24 w-full rounded-lg bg-gv-graphite-2 animate-pulse" />
              <div className="h-24 w-full rounded-lg bg-gv-graphite-2 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}