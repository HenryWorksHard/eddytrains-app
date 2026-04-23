/**
 * Skeleton loader for the client dashboard.
 *
 * Shape mirrors ClientDashboardContent: top bar (hamburger + streak pill),
 * greeting + Pascal hero, "Today's Workout" card, "Tomorrow" row,
 * 2-col Goal+Photo tiles, and the month calendar.
 *
 * BottomNav lives in the page itself, not the layout, so we omit it here —
 * the real BottomNav will appear once the page renders.
 *
 * Shared by `src/app/dashboard/loading.tsx` and the `if (!data)` branch of
 * `src/app/dashboard/ClientDashboard.tsx` so cold loads show a single
 * skeleton-to-content transition instead of skeleton -> GIF -> content.
 */
export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-black pb-nav">
      {/* Top bar: hamburger + streak pill */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-lg border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="w-9 h-9 bg-zinc-800 animate-pulse rounded-lg" />
          <div className="w-20 h-7 bg-zinc-800 animate-pulse rounded-full" />
        </div>
      </div>

      {/* Hero: greeting + Pascal + score */}
      <div className="px-4 pt-6 pb-4 flex flex-col items-center gap-3">
        <div className="h-5 w-40 bg-zinc-800 animate-pulse rounded" />
        <div className="w-[120px] h-[120px] bg-zinc-800 animate-pulse rounded-2xl" />
        <div className="h-4 w-32 bg-zinc-800 animate-pulse rounded" />
      </div>

      <main className="px-4 pb-6 space-y-6">
        {/* Today's Workout */}
        <section className="space-y-2">
          <div className="h-4 w-32 bg-zinc-800 animate-pulse rounded" />
          <div className="h-20 bg-zinc-900 border border-zinc-800 animate-pulse rounded-2xl" />
        </section>

        {/* Tomorrow row */}
        <section className="space-y-2">
          <div className="h-4 w-24 bg-zinc-800 animate-pulse rounded" />
          <div className="h-14 bg-zinc-900 border border-zinc-800 animate-pulse rounded-2xl" />
        </section>

        {/* Goal + Photo tiles (2-col) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 bg-zinc-900 border border-zinc-800 animate-pulse rounded-2xl" />
          <div className="h-28 bg-zinc-900 border border-zinc-800 animate-pulse rounded-2xl" />
        </div>

        {/* This Month calendar */}
        <section className="space-y-2">
          <div className="h-4 w-28 bg-zinc-800 animate-pulse rounded" />
          <div className="h-64 bg-zinc-900 border border-zinc-800 animate-pulse rounded-2xl" />
        </section>
      </main>
    </div>
  )
}
