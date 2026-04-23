/**
 * Skeleton loader for the goals page.
 *
 * Mirrors GoalsPage layout: sticky header (back arrow + title + Add button),
 * a section heading, then a stack of goal cards (title row + progress bar).
 *
 * Shared by `src/app/goals/loading.tsx` and the `if (!data)` branch of
 * `src/app/goals/page.tsx`.
 */
export default function GoalsSkeleton() {
  return (
    <div className="min-h-screen bg-black pb-nav">
      {/* Header */}
      <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-20">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-5 h-5 bg-zinc-800 animate-pulse rounded" />
          <div className="h-5 w-16 bg-zinc-800 animate-pulse rounded flex-1" />
          <div className="h-7 w-20 bg-zinc-800 animate-pulse rounded-lg" />
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Active section */}
        <section>
          <div className="h-3 w-20 bg-zinc-800 animate-pulse rounded mb-2" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-3/4 bg-zinc-800 animate-pulse rounded" />
                    <div className="h-3 w-1/2 bg-zinc-800 animate-pulse rounded" />
                  </div>
                  <div className="w-4 h-4 bg-zinc-800 animate-pulse rounded" />
                </div>
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="h-4 w-16 bg-zinc-800 animate-pulse rounded" />
                    <div className="h-3 w-8 bg-zinc-800 animate-pulse rounded" />
                  </div>
                  <div className="h-2 bg-zinc-800 animate-pulse rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
