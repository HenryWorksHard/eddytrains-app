import BottomNav from '../components/BottomNav'

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header skeleton */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 animate-pulse">
        <div className="h-7 bg-zinc-800 rounded w-24"></div>
      </header>

      <main className="px-6 py-6 space-y-6 animate-pulse">
        {/* Avatar & name skeleton */}
        <div className="flex flex-col items-center py-4">
          <div className="w-24 h-24 bg-zinc-800 rounded-full mb-4"></div>
          <div className="h-6 bg-zinc-800 rounded w-40 mb-2"></div>
          <div className="h-4 bg-zinc-800/60 rounded w-48"></div>
        </div>

        {/* Settings sections skeleton */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="h-5 bg-zinc-800 rounded w-28 mb-3"></div>
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex items-center justify-between py-2">
                    <div className="h-5 bg-zinc-800 rounded w-32"></div>
                    <div className="h-5 bg-zinc-800/60 rounded w-8"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
