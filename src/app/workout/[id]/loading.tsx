import BottomNav from '../../components/BottomNav'

export default function WorkoutLoading() {
  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header skeleton */}
      <header className="bg-gradient-to-b from-zinc-900 to-black border-b border-zinc-800 animate-pulse">
        <div className="px-6 py-4">
          <div className="w-20 h-8 bg-zinc-800 rounded-lg"></div>
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl"></div>
            <div className="flex-1">
              <div className="h-7 bg-zinc-800 rounded w-48 mb-2"></div>
              <div className="h-4 bg-zinc-800/60 rounded w-32 mb-2"></div>
              <div className="h-4 bg-zinc-800/40 rounded w-24"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Exercises skeleton */}
      <main className="px-6 py-6 animate-pulse">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-5 bg-zinc-800 rounded w-40 mb-2"></div>
                  <div className="h-4 bg-zinc-800/60 rounded w-28 mb-3"></div>
                  <div className="flex gap-4">
                    <div className="h-8 bg-zinc-800/40 rounded w-16"></div>
                    <div className="h-8 bg-zinc-800/40 rounded w-20"></div>
                    <div className="h-8 bg-zinc-800/40 rounded w-16"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
