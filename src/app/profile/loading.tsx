/**
 * Skeleton loader for the profile page.
 *
 * Mirrors header + avatar, 1RM grid (2x3), settings list rows.
 */
export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-black pb-nav">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-lg border-b border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-5 h-5 bg-zinc-800 animate-pulse rounded" />
          <div className="h-5 w-20 bg-zinc-800 animate-pulse rounded" />
        </div>
      </div>

      <main className="px-4 py-6 space-y-6">
        {/* Avatar block */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 bg-zinc-800 animate-pulse rounded-full" />
          <div className="h-5 w-32 bg-zinc-800 animate-pulse rounded" />
          <div className="h-4 w-40 bg-zinc-800 animate-pulse rounded" />
        </div>

        {/* 1RM grid (2x3) */}
        <div className="space-y-2">
          <div className="h-4 w-24 bg-zinc-800 animate-pulse rounded" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-20 bg-zinc-900 border border-zinc-800 animate-pulse rounded-xl"
              />
            ))}
          </div>
        </div>

        {/* Settings list */}
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-zinc-900 border border-zinc-800 animate-pulse rounded-xl"
            />
          ))}
        </div>
      </main>
    </div>
  )
}
