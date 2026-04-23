/**
 * Skeleton loader for the workout detail page.
 *
 * Mirrors header (back + workout name), exercise cards, and the
 * inline complete-workout button at the bottom.
 */
export default function WorkoutLoading() {
  return (
    <div className="min-h-screen bg-black pb-nav">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-lg border-b border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="w-5 h-5 bg-zinc-800 animate-pulse rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-zinc-800 animate-pulse rounded" />
            <div className="h-3 w-24 bg-zinc-800 animate-pulse rounded" />
          </div>
        </div>
      </div>

      <main className="px-4 py-4 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 bg-zinc-900 border border-zinc-800 animate-pulse rounded-2xl"
          />
        ))}

        {/* Inline complete button */}
        <div className="h-14 bg-zinc-900 border border-zinc-800 animate-pulse rounded-xl mt-4" />
      </main>
    </div>
  )
}
