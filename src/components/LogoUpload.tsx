'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { Upload, Loader2, Trash2, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'

interface LogoUploadProps {
  organizationId: string
  currentLogoUrl: string | null
}

export default function LogoUpload({ organizationId, currentLogoUrl }: LogoUploadProps) {
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Crop image to square
  const cropToSquare = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = Math.min(img.width, img.height)
        canvas.width = 200 // Output size
        canvas.height = 200
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        // Calculate crop position (center crop)
        const offsetX = (img.width - size) / 2
        const offsetY = (img.height - size) / 2

        // Draw cropped and resized image
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 200, 200)

        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Could not create blob'))
        }, 'image/png', 0.9)
      }
      img.onerror = () => reject(new Error('Could not load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Crop to square
      const croppedBlob = await cropToSquare(file)
      
      // Generate unique filename
      const fileName = `${organizationId}-logo-${Date.now()}.png`
      const filePath = `logos/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('organization-assets')
        .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/png' })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(filePath)

      // Update organization record
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: publicUrl })
        .eq('id', organizationId)

      if (updateError) throw updateError

      setLogoUrl(publicUrl)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Failed to upload logo')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async () => {
    if (!logoUrl) return

    setDeleting(true)
    setError(null)

    try {
      // Extract file path from URL
      const urlParts = logoUrl.split('/organization-assets/')
      if (urlParts[1]) {
        await supabase.storage
          .from('organization-assets')
          .remove([urlParts[1]])
      }

      // Clear logo URL in database
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: null })
        .eq('id', organizationId)

      if (updateError) throw updateError

      setLogoUrl(null)
    } catch (err: any) {
      console.error('Delete error:', err)
      setError(err.message || 'Failed to delete logo')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Current Logo Preview */}
      <div className="flex items-start gap-6">
        <div className="w-24 h-24 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Organization logo"
              width={96}
              height={96}
              className="w-full h-full object-contain"
            />
          ) : (
            <ImageIcon className="w-8 h-8 text-zinc-600" />
          )}
        </div>

        <div className="flex-1">
          <p className="text-sm text-zinc-400 mb-3">
            Upload your logo. Recommended size: 200x200px. Max 2MB.
          </p>
          
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              id="logo-upload"
            />
            <label
              htmlFor="logo-upload"
              className={`inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors cursor-pointer ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {logoUrl ? 'Change Logo' : 'Upload Logo'}
            </label>

            {logoUrl && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
