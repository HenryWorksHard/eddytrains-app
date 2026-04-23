/**
 * Skeleton loader for the progress page.
 *
 * Mirrors PageHeader + ProgressClient layout:
 * hero stats row (3 tiles), volume/exercise toggle, period picker,
 * chart area, 1RM list, month recap card.
 *
 * Shared by `src/app/progress/loading.tsx` and the `if (!data)` branch of
 * `src/app/progress/page.tsx`.
 */
export default function ProgressSkeleton() {
  return (
    <div className="min-h-screen bg-black pb-nav">
      {/* PageHeader */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-lg border-b border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-5 h-5 bg-zinc-800 animate-pulse rounded" />
          <div className="h-5 w-24 bg-zinc-800 animate-pulse rounded" />
        </div>
      </div>

      <main className="px-4 py-4 space-y-4">
        {/* Hero stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-zinc-900 border border-zinc-800 animate-pulse rounded-2xl"
            />
          ))}
        </div>

        {/* Volume / Exercise toggle */}
        <div className="h-12 bg-zinc-900 border border-zinc-800 animate-pulse rounded-xl" />

        {/* Period picker */}
        <div className="h-10 bg-zinc-900 border border-zinc-800 animate-pulse rounded-lg w-1/2" />

        {/* Chart area */}
        <div className="h-64 bg-zinc-900 border border-zinc-800 animate-pulse rounded-2xl" />

        {/* 1RM list */}
        <div className="space-y-2">
          <div className="h-4 w-24 bg-zinc-800 animate-pulse rounded mb-2" />
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 bg-zinc-900 border border-zinc-800 animate-pulse rounded-xl"
            />
          ))}
        </div>

        {/* Month recap card */}
        <div className="h-32 bg-zinc-900 border border-zinc-800 animate-pulse rounded-2xl" />
      </main>
    </div>
  )
}
