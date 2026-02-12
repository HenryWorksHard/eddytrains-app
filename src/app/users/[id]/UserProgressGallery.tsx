'use client'

import { useState, useEffect } from 'react'
import { Camera, Loader2, X, ChevronLeft, ChevronRight, Columns2 } from 'lucide-react'
import Image from 'next/image'

interface ProgressImage {
  id: string
  image_url: string
  notes: string | null
  created_at: string
}

interface UserProgressGalleryProps {
  userId: string
}

export default function UserProgressGallery({ userId }: UserProgressGalleryProps) {
  const [images, setImages] = useState<ProgressImage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  
  // Comparison mode
  const [compareMode, setCompareMode] = useState(false)
  const [compareImages, setCompareImages] = useState<[number | null, number | null]>([null, null])

  useEffect(() => {
    fetchImages()
  }, [userId])

  const fetchImages = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/users/${userId}/progress-images`)
      const { data, error } = await response.json()

      if (error) throw new Error(error)
      setImages(data || [])
    } catch (err) {
      console.error('Failed to fetch progress images:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
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

  const handleImageClick = (idx: number) => {
    if (compareMode) {
      // In compare mode, select images for comparison
      if (compareImages[0] === null) {
        setCompareImages([idx, null])
      } else if (compareImages[1] === null && compareImages[0] !== idx) {
        setCompareImages([compareImages[0], idx])
      } else {
        // Reset and start new selection
        setCompareImages([idx, null])
      }
    } else {
      setSelectedIndex(idx)
    }
  }

  const exitCompareMode = () => {
    setCompareMode(false)
    setCompareImages([null, null])
  }

  const isSelectedForCompare = (idx: number) => {
    return compareImages[0] === idx || compareImages[1] === idx
  }

  return (
    <>
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Progress Pictures</h2>
            {images.length > 0 && (
              <span className="text-sm text-zinc-500">({images.length} photos)</span>
            )}
          </div>
          
          {images.length >= 2 && (
            <button
              onClick={() => compareMode ? exitCompareMode() : setCompareMode(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                compareMode 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Columns2 className="w-4 h-4" />
              <span className="text-sm font-medium">{compareMode ? 'Exit Compare' : 'Compare'}</span>
            </button>
          )}
        </div>
        
        {/* Compare Mode Instructions */}
        {compareMode && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-4">
            <p className="text-purple-300 text-sm">
              {compareImages[0] === null 
                ? '👆 Select the BEFORE image (first photo)'
                : compareImages[1] === null 
                  ? '👆 Now select the AFTER image (second photo)'
                  : '✅ Click images to change selection'
              }
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-8">
            <Camera className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No progress images yet</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-zinc-800/50 rounded-lg px-3 py-1.5">
                <span className="text-zinc-400 text-xs">
                  First: {formatDate(images[images.length - 1].created_at)}
                </span>
              </div>
              <div className="bg-zinc-800/50 rounded-lg px-3 py-1.5">
                <span className="text-zinc-400 text-xs">
                  Latest: {formatDate(images[0].created_at)}
                </span>
              </div>
            </div>

            {/* Image Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => handleImageClick(idx)}
                  className={`aspect-square relative rounded-lg overflow-hidden bg-zinc-800 transition-all ${
                    compareMode && isSelectedForCompare(idx)
                      ? 'ring-2 ring-purple-400'
                      : 'hover:ring-2 hover:ring-purple-400'
                  }`}
                >
                  <Image
                    src={img.image_url}
                    alt={`Progress ${formatDate(img.created_at)}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 25vw, 12vw"
                  />
                  {/* Compare selection indicator */}
                  {compareMode && isSelectedForCompare(idx) && (
                    <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                      <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded">
                        {compareImages[0] === idx ? 'BEFORE' : 'AFTER'}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Full Image Viewer */}
      {selectedIndex !== null && images[selectedIndex] && (
        <div 
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
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

          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>

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

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-sm px-4 py-2 rounded-xl">
            <p className="text-white font-medium text-center">{formatDate(images[selectedIndex].created_at)}</p>
            <p className="text-zinc-500 text-xs text-center mt-1">
              {selectedIndex + 1} of {images.length}
            </p>
          </div>
        </div>
      )}

      {/* Comparison View */}
      {compareMode && compareImages[0] !== null && compareImages[1] !== null && (
        <div 
          className="fixed inset-0 bg-black/95 z-[60] flex flex-col"
          onClick={() => exitCompareMode()}
        >
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Columns2 className="w-5 h-5 text-purple-400" />
              Before / After Comparison
            </h3>
            <button
              onClick={() => exitCompareMode()}
              className="p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4 gap-4" onClick={e => e.stopPropagation()}>
            {/* Before Image */}
            <div className="flex-1 flex flex-col items-center max-w-[45vw]">
              <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-zinc-800">
                <Image
                  src={images[compareImages[0]].image_url}
                  alt="Before"
                  fill
                  className="object-contain"
                  sizes="45vw"
                />
              </div>
              <div className="mt-3 text-center">
                <span className="inline-block px-3 py-1 bg-zinc-800 text-white text-sm font-medium rounded-full mb-1">
                  BEFORE
                </span>
                <p className="text-zinc-400 text-sm">{formatDate(images[compareImages[0]].created_at)}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-[60vh] w-px bg-zinc-700" />

            {/* After Image */}
            <div className="flex-1 flex flex-col items-center max-w-[45vw]">
              <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-zinc-800">
                <Image
                  src={images[compareImages[1]].image_url}
                  alt="After"
                  fill
                  className="object-contain"
                  sizes="45vw"
                />
              </div>
              <div className="mt-3 text-center">
                <span className="inline-block px-3 py-1 bg-purple-500 text-white text-sm font-medium rounded-full mb-1">
                  AFTER
                </span>
                <p className="text-zinc-400 text-sm">{formatDate(images[compareImages[1]].created_at)}</p>
              </div>
            </div>
          </div>

          {/* Time difference */}
          <div className="p-4 border-t border-zinc-800 flex justify-center">
            <div className="bg-zinc-900/90 backdrop-blur-sm px-6 py-3 rounded-xl text-center">
              <p className="text-zinc-400 text-sm">Time between photos</p>
              <p className="text-white font-bold text-lg">
                {Math.abs(Math.round((new Date(images[compareImages[1]].created_at).getTime() - new Date(images[compareImages[0]].created_at).getTime()) / (1000 * 60 * 60 * 24)))} days
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
