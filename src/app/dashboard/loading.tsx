import BrandMark from '@/components/BrandMark'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <BrandMark size="lg" className="mb-6" priority />
      <div className="w-8 h-8 border-[3px] border-zinc-700 border-t-yellow-400 rounded-full animate-spin"></div>
      <p className="text-zinc-500 text-sm mt-4">Loading...</p>
    </div>
  )
}
