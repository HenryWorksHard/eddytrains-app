'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '../lib/supabase/client'
import Image from 'next/image'

interface ProgressImage {
  id: string
  image_url: string
  notes: string | null
  created_at: string
}

export default function ProgressPictures() {
  const [images, setImages] = useState<ProgressImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [selectedImage, setSelectedImage] = useState<ProgressImage | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchImages()
  }, [])

  const fetchImages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('progress_images')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching images:', error)
        return
      }

      setImages(data || [])
    } catch (err) {
      console.error('Failed to fetch progress images:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload to storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('progress-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('progress-images')
        .getPublicUrl(fileName)

      // Insert record
      const { error: insertError } = await supabase
        .from('progress_images')
        .insert({
          client_id: user.id,
          image_url: publicUrl
        })

      if (insertError) throw insertError

      // Refresh images
      await fetchImages()
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const deleteImage = async (imageId: string, imageUrl: string) => {
    if (!confirm('Delete this progress photo?')) return

    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/progress-images/')
      if (urlParts[1]) {
        await supabase.storage
          .from('progress-images')
          .remove([urlParts[1]])
      }

      await supabase
        .from('progress_images')
        .delete()
        .eq('id', imageId)

      setImages(prev => prev.filter(img => img.id !== imageId))
      setSelectedImage(null)
    } catch (err) {
      console.error('Delete failed:', err)
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

  const daysSinceLastPhoto = () => {
    if (images.length === 0) return null
    const lastDate = new Date(images[0].created_at)
    const today = new Date()
    const diffTime = today.getTime() - lastDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const days = daysSinceLastPhoto()
  const shouldRemind = days === null || days >= 7

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Progress Pictures</h2>
          {images.length > 4 && (
            <button 
              onClick={() => setExpanded(!expanded)}
              className="text-yellow-400 text-sm"
            >
              {expanded ? 'Show less' : 'View all'}
            </button>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          {/* Reminder Banner */}
          {shouldRemind && (
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-3 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-yellow-400 font-medium text-sm">
                  {days === null ? 'Start tracking your progress!' : `${days} days since last photo`}
                </p>
                <p className="text-zinc-400 text-xs">Weekly photos help you see your transformation</p>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 border border-zinc-700 rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-colors mb-4"
          >
            {uploading ? (
              <>
                <svg className="w-5 h-5 animate-spin text-yellow-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-zinc-400">Uploading...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-white font-medium">Add Progress Photo</span>
              </>
            )}
          </button>

          {/* Image Grid */}
          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-square bg-zinc-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : images.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {(expanded ? images : images.slice(0, 8)).map((img) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(img)}
                  className="aspect-square relative rounded-lg overflow-hidden bg-zinc-800 hover:ring-2 hover:ring-yellow-400 transition-all"
                >
                  <Image
                    src={img.image_url}
                    alt="Progress"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 25vw, 100px"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <p className="text-[9px] text-zinc-300 truncate">{formatDate(img.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-zinc-500 text-sm">No progress photos yet</p>
              <p className="text-zinc-600 text-xs mt-1">Take your first photo to start tracking!</p>
            </div>
          )}

          {/* Stats */}
          {images.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between text-sm">
              <span className="text-zinc-500">{images.length} photos</span>
              {images.length >= 2 && (
                <span className="text-zinc-500">
                  First: {formatDate(images[images.length - 1].created_at)}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Full Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-lg w-full"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900">
              <Image
                src={selectedImage.image_url}
                alt="Progress"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 500px"
              />
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <p className="text-white font-medium">{formatDate(selectedImage.created_at)}</p>
              <button
                onClick={() => deleteImage(selectedImage.id, selectedImage.image_url)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
