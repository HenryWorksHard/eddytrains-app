'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { Camera, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'

interface ProgressImage {
  id: string
  image_url: string
  notes: string | null
  created_at: string
}

interface UserProgressImagesProps {
  userId: string
  userName: string
}

export default function UserProgressImages({ userId, userName }: UserProgressImagesProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [images, setImages] = useState<ProgressImage[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const supabase = createClient()

  const fetchImages = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('progress_images')
        .select('*')
        .eq('client_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setImages(data || [])
    } catch (err) {
      console.error('Failed to fetch progress images:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchImages()
    }
  }, [isOpen, userId])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit'
    })
  }

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedIndex === null) return
    if (direction === 'prev' && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    } else if (direction === 'next' && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl transition-colors"
      >
        <Camera className="w-4 h-4" />
        Progress Images
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Progress Images</h3>
                  <p className="text-sm text-zinc-500">{userName}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
              ) : images.length === 0 ? (
                <div className="text-center py-12">
                  <Camera className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">No progress images yet</p>
                  <p className="text-zinc-500 text-sm mt-1">This client hasn't uploaded any progress photos</p>
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-zinc-800/50 rounded-xl px-4 py-2">
                      <span className="text-2xl font-bold text-white">{images.length}</span>
                      <span className="text-zinc-400 text-sm ml-1">photos</span>
                    </div>
                    {images.length >= 2 && (
                      <div className="bg-zinc-800/50 rounded-xl px-4 py-2">
                        <span className="text-zinc-400 text-sm">
                          Tracking since {formatDate(images[images.length - 1].created_at)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Image Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        onClick={() => setSelectedIndex(idx)}
                        className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 hover:ring-2 hover:ring-purple-400 transition-all"
                      >
                        <Image
                          src={img.image_url}
                          alt={`Progress ${formatDate(img.created_at)}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white text-xs font-medium">{formatDate(img.created_at)}</p>
                          <p className="text-zinc-400 text-[10px]">{formatTime(img.created_at)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Image Viewer */}
      {selectedIndex !== null && images[selectedIndex] && (
        <div 
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          {/* Navigation */}
          {selectedIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateImage('prev') }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}
          {selectedIndex < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateImage('next') }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Close button */}
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Image */}
          <div 
            className="relative w-full max-w-2xl h-[80vh] mx-4"
            onClick={e => e.stopPropagation()}
          >
            <Image
              src={images[selectedIndex].image_url}
              alt={`Progress ${formatDate(images[selectedIndex].created_at)}`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 700px"
            />
          </div>

          {/* Date info */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-sm px-4 py-2 rounded-xl">
            <p className="text-white font-medium text-center">{formatDate(images[selectedIndex].created_at)}</p>
            <p className="text-zinc-400 text-sm text-center">{formatTime(images[selectedIndex].created_at)}</p>
            <p className="text-zinc-500 text-xs text-center mt-1">
              {selectedIndex + 1} of {images.length}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
