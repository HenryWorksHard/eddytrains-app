import Image from 'next/image'

type Props = {
  message?: string
}

/**
 * The app's single full-screen loading experience.
 * Uses /loading.gif so any transition between pages or auth states shows
 * the same consistent element, not a patchwork of spinners.
 */
export default function AppLoading({ message = 'Loading...' }: Props) {
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
      <p className="text-zinc-500 text-sm">{message}</p>
    </div>
  )
}
