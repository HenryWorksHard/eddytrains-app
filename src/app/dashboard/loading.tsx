import Image from 'next/image'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <Image
        src="/loading.gif"
        alt="Loading"
        width={120}
        height={120}
        priority
        unoptimized
        className="mb-2"
      />
      <p className="text-zinc-500 text-sm">Loading...</p>
    </div>
  )
}
