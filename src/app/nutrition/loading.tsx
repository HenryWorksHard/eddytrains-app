/**
 * Skeleton loader for the nutrition page.
 *
 * Mirrors header + "My Plan" card (calories + 3 macro tiles) + days list.
 */
export default function NutritionLoading() {
  return (
    <div className="min-h-screen bg-black pb-nav">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-lg border-b border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-5 h-5 bg-zinc-800 animate-pulse rounded" />
          <div className="h-5 w-24 bg-zinc-800 animate-pulse rounded" />
        </div>
      </div>

      <main className="px-4 py-4 space-y-4">
        {/* My Plan card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="h-4 w-20 bg-zinc-800 animate-pulse rounded" />
          <div className="h-10 w-32 bg-zinc-800 animate-pulse rounded" />
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 bg-zinc-800 animate-pulse rounded-xl"
              />
            ))}
          </div>
        </div>

        {/* Days list */}
        <div className="space-y-2">
          <div className="h-4 w-20 bg-zinc-800 animate-pulse rounded" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-12 bg-zinc-900 border border-zinc-800 animate-pulse rounded-xl"
            />
          ))}
        </div>
      </main>
    </div>
  )
}
