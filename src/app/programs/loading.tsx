import BottomNav from '../components/BottomNav'
import PageHeader from '../components/PageHeader'

export default function ProgramsLoading() {
  return (
    <div className="min-h-screen bg-black pb-24">
      <PageHeader title="Programs" />
      
      <main className="px-6 py-6 animate-pulse">
        {/* Active program card skeleton */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-zinc-800 rounded-xl"></div>
            <div className="flex-1">
              <div className="h-6 bg-zinc-800 rounded w-48 mb-2"></div>
              <div className="h-4 bg-zinc-800/60 rounded w-full mb-2"></div>
              <div className="h-4 bg-zinc-800/60 rounded w-3/4 mb-3"></div>
              <div className="h-8 bg-zinc-800/40 rounded w-32"></div>
            </div>
          </div>
          
          {/* Progress bar skeleton */}
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <div className="flex justify-between mb-2">
              <div className="h-4 bg-zinc-800 rounded w-20"></div>
              <div className="h-4 bg-zinc-800 rounded w-16"></div>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full"></div>
          </div>
        </div>
        
        {/* Weekly schedule skeleton */}
        <div className="h-5 bg-zinc-800 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-5 bg-zinc-800 rounded w-32 mb-1"></div>
                  <div className="h-4 bg-zinc-800/60 rounded w-24"></div>
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
