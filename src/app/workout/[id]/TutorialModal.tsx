'use client'

import { useState } from 'react'

interface TutorialModalProps {
  exerciseName: string
  videoUrl?: string
  steps?: string[]
}

export default function TutorialModal({ exerciseName, videoUrl, steps }: TutorialModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Convert YouTube URLs to embed format
  const getEmbedUrl = (url: string) => {
    if (!url) return null
    
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be') 
        ? url.split('youtu.be/')[1]?.split('?')[0]
        : url.split('v=')[1]?.split('&')[0]
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }
    
    // Vimeo
    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0]
      if (videoId) return `https://player.vimeo.com/video/${videoId}`
    }
    
    // Direct video URL
    return url
  }

  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : null
  const isDirectVideo = videoUrl && (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm'))

  return (
    <>
      {/* Tutorial Button - Compact Icon */}
      <button 
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 rounded-lg bg-yellow-400/10 hover:bg-yellow-400/20 flex items-center justify-center text-yellow-400 transition-colors flex-shrink-0"
        title="View tutorial"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-white">{exerciseName}</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Video */}
              {embedUrl && (
                <div className="relative bg-black aspect-video">
                  {isDirectVideo ? (
                    <video 
                      src={videoUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>
              )}

              {/* Steps */}
              {steps && steps.length > 0 && (
                <div className="p-4">
                  <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
                    How to perform
                  </h4>
                  <ol className="space-y-3">
                    {steps.map((step, idx) => (
                      <li key={idx} className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-yellow-400/10 text-yellow-400 flex items-center justify-center text-sm font-medium flex-shrink-0">
                          {idx + 1}
                        </span>
                        <p className="text-white text-sm leading-relaxed">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* No content fallback */}
              {!embedUrl && (!steps || steps.length === 0) && (
                <div className="p-8 text-center">
                  <p className="text-zinc-400">Tutorial content coming soon.</p>
                </div>
              )}
            </div>

            {/* Close button */}
            <div className="p-4 border-t border-zinc-800">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
