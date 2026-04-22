type Props = {
  message?: string
}

/**
 * The app's single full-screen loading experience.
 * Uses /loading.gif so any transition between pages or auth states shows
 * the same consistent element, not a patchwork of spinners.
 *
 * Using a plain <img> tag rather than next/image — next/image with
 * unoptimized=true has been observed to freeze GIFs on the first frame
 * in some browsers (Safari in particular).
 */
export default function AppLoading({ message = 'Loading...' }: Props) {
  return (
    // Fixed inset-0 covers the full viewport (ignores the body's
    // safe-area-inset-top padding), so the GIF sits at TRUE center
    // on every device regardless of notch / Dynamic Island size.
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/loading.gif"
        alt="Loading"
        width={120}
        height={120}
        className="mb-2"
      />
      <p className="text-zinc-500 text-sm">{message}</p>
    </div>
  )
}
