/**
 * Skeleton loader for the programs page.
 *
 * Mirrors PageHeader + ClientProgramsContent: a stack of program cards.
 */
export default function ProgramsLoading() {
  return (
    <div className="min-h-screen bg-black pb-nav">
      {/* PageHeader */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-lg border-b border-zinc-800">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-5 h-5 bg-zinc-800 animate-pulse rounded" />
          <div className="h-5 w-24 bg-zinc-800 animate-pulse rounded" />
        </div>
      </div>

      <main className="px-6 py-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 bg-zinc-900 border border-zinc-800 animate-pulse rounded-2xl"
          />
        ))}
      </main>
    </div>
  )
}
