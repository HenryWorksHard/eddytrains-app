import BottomNav from '../components/BottomNav'
import PageHeader from '../components/PageHeader'

export default function NutritionLoading() {
  return (
    <div className="min-h-screen bg-black pb-32">
      <PageHeader title="Nutrition" />
      
      <main className="px-6 py-6 space-y-6 animate-pulse">
        {/* Plan card skeleton */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 bg-zinc-800 rounded-full w-24"></div>
          </div>
          
          {/* Calories skeleton */}
          <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="h-5 bg-zinc-700 rounded w-16"></div>
              <div className="h-8 bg-zinc-700 rounded w-20"></div>
            </div>
          </div>
          
          {/* Macros grid skeleton */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
              <div className="h-6 bg-zinc-700 rounded w-12 mx-auto mb-1"></div>
              <div className="h-4 bg-zinc-700/50 rounded w-14 mx-auto"></div>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
              <div className="h-6 bg-zinc-700 rounded w-12 mx-auto mb-1"></div>
              <div className="h-4 bg-zinc-700/50 rounded w-10 mx-auto"></div>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
              <div className="h-6 bg-zinc-700 rounded w-12 mx-auto mb-1"></div>
              <div className="h-4 bg-zinc-700/50 rounded w-8 mx-auto"></div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
