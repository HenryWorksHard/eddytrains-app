'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({ className = '' }: { className?: string }) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className={`text-yellow-400 text-sm font-medium inline-flex items-center gap-1 ${className}`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  )
}
