export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center mb-6">
        <span className="text-black text-2xl font-bold">C</span>
      </div>
      {/* Spinner */}
      <div className="w-8 h-8 border-3 border-zinc-700 border-t-yellow-400 rounded-full animate-spin"></div>
      <p className="text-zinc-500 text-sm mt-4">Loading...</p>
    </div>
  )
}
