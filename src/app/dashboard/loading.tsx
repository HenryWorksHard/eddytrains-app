import BottomNav from '../components/BottomNav'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-black pb-32">
      <div className="px-6 pt-14 pb-6 animate-pulse">
        {/* Header skeleton */}
        <div className="h-8 bg-zinc-800 rounded-lg w-48 mb-2"></div>
        <div className="h-5 bg-zinc-800/60 rounded w-64 mb-8"></div>
        
        {/* Today's workout card skeleton */}
        <div className="bg-zinc-900 rounded-2xl p-6 mb-6">
          <div className="h-5 bg-zinc-800 rounded w-32 mb-4"></div>
          <div className="h-16 bg-zinc-800 rounded-xl mb-3"></div>
          <div className="h-12 bg-zinc-800 rounded-xl"></div>
        </div>
        
        {/* Calendar skeleton */}
        <div className="bg-zinc-900 rounded-2xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 bg-zinc-800 rounded w-24"></div>
            <div className="h-5 bg-zinc-800 rounded w-20"></div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-4 bg-zinc-800 rounded"></div>
            ))}
            {[...Array(35)].map((_, i) => (
              <div key={i} className="h-10 bg-zinc-800/50 rounded-lg"></div>
            ))}
          </div>
        </div>
        
        {/* Weekly schedule skeleton */}
        <div className="bg-zinc-900 rounded-2xl p-6">
          <div className="h-5 bg-zinc-800 rounded w-36 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 bg-zinc-800 rounded w-10"></div>
                <div className="h-12 bg-zinc-800 rounded-xl flex-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
