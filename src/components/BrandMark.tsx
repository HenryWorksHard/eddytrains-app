import Image from 'next/image'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<Size, { box: string; rounded: string; pixel: number }> = {
  xs: { box: 'w-8 h-8', rounded: 'rounded-lg', pixel: 32 },
  sm: { box: 'w-9 h-9', rounded: 'rounded-lg', pixel: 36 },
  md: { box: 'w-10 h-10', rounded: 'rounded-xl', pixel: 40 },
  lg: { box: 'w-16 h-16', rounded: 'rounded-2xl', pixel: 64 },
  xl: { box: 'w-20 h-20', rounded: 'rounded-2xl', pixel: 80 },
}

type Props = {
  size?: Size
  className?: string
  priority?: boolean
}

/**
 * The app's brand logo, rendered with a rounded black frame.
 * Single source of truth — if the logo file or rounding ever changes, update here.
 */
export default function BrandMark({ size = 'md', className = '', priority = false }: Props) {
  const { box, rounded, pixel } = SIZE_MAP[size]
  return (
    <div className={`${box} ${rounded} bg-black overflow-hidden flex items-center justify-center ${className}`}>
      <Image
        src="/logo.svg"
        alt="CMPD"
        width={pixel}
        height={pixel}
        priority={priority}
        className="w-full h-full object-contain"
      />
    </div>
  )
}
