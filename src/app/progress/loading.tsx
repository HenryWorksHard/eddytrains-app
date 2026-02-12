import BottomNav from '../components/BottomNav'

export default function ProgressLoading() {
  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header skeleton */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 animate-pulse">
        <div className="h-7 bg-zinc-800 rounded w-32"></div>
      </header>

      <main className="px-6 py-6 space-y-6 animate-pulse">
        {/* Stats cards skeleton */}
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="h-4 bg-zinc-800 rounded w-20 mb-2"></div>
              <div className="h-8 bg-zinc-800 rounded w-16"></div>
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="h-5 bg-zinc-800 rounded w-40 mb-4"></div>
          <div className="h-48 bg-zinc-800/50 rounded-xl"></div>
        </div>

        {/* Exercise list skeleton */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="h-5 bg-zinc-800 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="h-5 bg-zinc-800 rounded w-36"></div>
                <div className="h-5 bg-zinc-800 rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
