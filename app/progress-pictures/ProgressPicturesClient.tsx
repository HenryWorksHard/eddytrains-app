'use client'

import { useState, useRef } from 'react'
import { createClient } from '../lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'

interface ProgressImage {
  id: string
  image_url: string
  notes: string | null
  created_at: string
}

interface Props {
  initialImages: ProgressImage[]
}

export default function ProgressPicturesClient({ initialImages }: Props) {
  const [images, setImages] = useState<ProgressImage[]>(initialImages)
  const [uploading, setUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<ProgressImage | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('progress-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('progress-images')
        .getPublicUrl(fileName)

      const { data: newImage, error: insertError } = await supabase
        .from('progress_images')
        .insert({
          client_id: user.id,
          image_url: publicUrl
        })
        .select()
        .single()

      if (insertError) throw insertError

      setImages(prev => [newImage, ...prev])
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
      {/* Header */}
      <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        <div className="px-6 py-4">
          <Link href="/dashboard" className="text-yellow-400 text-sm font-medium mb-2 inline-block">
            ← Back
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-wide">Progress Pictures</h1>
          </div>
          <p className="text-zinc-500 text-sm mt-1">Track your transformation</p>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6">
        {/* Reminder Banner */}
        {shouldRemind && (
          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-yellow-400 font-medium">
                {days === null ? 'Start tracking your progress!' : `${days} days since last photo`}
              </p>
              <p className="text-zinc-400 text-sm">Weekly photos help you see your transformation</p>
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
          className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          {uploading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Progress Photo
            </>
          )}
        </button>

        {/* Stats */}
        {images.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
              <span className="text-xl font-bold text-white">{images.length}</span>
              <span className="text-zinc-400 text-sm ml-1">photos</span>
            </div>
            {images.length >= 2 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2">
                <span className="text-zinc-400 text-sm">
                  Tracking since {formatDate(images[images.length - 1].created_at)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Image Grid */}
        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => setSelectedImage(img)}
                className="aspect-[3/4] relative rounded-xl overflow-hidden bg-zinc-800 hover:ring-2 hover:ring-yellow-400 transition-all"
              >
                <Image
                  src={img.image_url}
                  alt="Progress"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 33vw, 150px"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs text-zinc-300">{formatDate(img.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold mb-2">No progress photos yet</h3>
            <p className="text-zinc-500 text-sm">Take your first photo to start tracking your transformation!</p>
          </div>
        )}
      </main>

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
