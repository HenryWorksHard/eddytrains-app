/**
 * Skeleton loader for the workout log page.
 *
 * Mirrors LogClient layout: sticky date-picker header, then a stack of
 * day/workout cards each with a header strip and a few exercise rows.
 */
export default function LogLoading() {
  return (
    <div className="min-h-screen bg-black pb-nav">
      {/* Sticky header: title + date pickers */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-lg border-b border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-5 w-20 bg-zinc-800 animate-pulse rounded" />
          <div className="ml-auto h-8 w-24 bg-zinc-800 animate-pulse rounded-lg" />
          <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded-lg" />
        </div>
      </div>

      <main className="px-4 py-4 space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
          >
            {/* Card header */}
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="h-4 w-40 bg-zinc-800 animate-pulse rounded" />
              <div className="h-4 w-16 bg-zinc-800 animate-pulse rounded" />
            </div>
            {/* Exercise rows */}
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="h-4 flex-1 bg-zinc-800 animate-pulse rounded" />
                  <div className="h-4 w-12 bg-zinc-800 animate-pulse rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
