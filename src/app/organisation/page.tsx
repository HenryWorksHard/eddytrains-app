'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { Building2, Upload, Save, X, Loader2, Lock } from 'lucide-react'
import Image from 'next/image'

export default function OrganisationPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [isCompanyTrainer, setIsCompanyTrainer] = useState(false) // Trainer under a company
  const [organisation, setOrganisation] = useState<{
    id: string
    name: string
    slug: string
    logo_url: string | null
    brand_color: string
  } | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    brand_color: '#FACC15'
  })
  const [previewLogo, setPreviewLogo] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)

  useEffect(() => {
    loadOrganisation()
  }, [])

  async function loadOrganisation() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id, company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      router.push('/login')
      return
    }

    setUserRole(profile.role)

    // Check if this trainer is under a company
    if (profile.role === 'trainer' && profile.company_id) {
      setIsCompanyTrainer(true)
      // Load company's organisation instead
      const { data: company } = await supabase
        .from('organizations')
        .select('id, name, slug, logo_url, brand_color')
        .eq('id', profile.company_id)
        .single()

      if (company) {
        setOrganisation(company)
        setFormData({
          name: company.name,
          slug: company.slug,
          brand_color: company.brand_color || '#FACC15'
        })
        setPreviewLogo(company.logo_url)
      }
    } else {
      // Load own organisation
      const orgId = profile.organization_id || profile.company_id
      if (orgId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name, slug, logo_url, brand_color')
          .eq('id', orgId)
          .single()

        if (org) {
          setOrganisation(org)
          setFormData({
            name: org.name,
            slug: org.slug,
            brand_color: org.brand_color || '#FACC15'
          })
          setPreviewLogo(org.logo_url)
        }
      }
    }

    setLoading(false)
  }

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB')
      return
    }

    setLogoFile(file)
    setPreviewLogo(URL.createObjectURL(file))
  }

  const removeLogo = () => {
    setLogoFile(null)
    setPreviewLogo(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !organisation) return organisation?.logo_url || null

    setUploading(true)
    try {
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${organisation.id}-logo.${fileExt}`
      const filePath = `logos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('organization-assets')
        .upload(filePath, logoFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Logo upload error:', error)
      alert('Failed to upload logo')
      return organisation.logo_url
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!organisation) return
    setSaving(true)

    try {
      let logoUrl = organisation.logo_url

      // Upload new logo if selected
      if (logoFile) {
        logoUrl = await uploadLogo()
      } else if (previewLogo === null && organisation.logo_url) {
        // Logo was removed
        logoUrl = null
      }

      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          slug: formData.slug,
          logo_url: logoUrl,
          brand_color: formData.brand_color,
        })
        .eq('id', organisation.id)

      if (error) throw error

      alert('Organisation updated successfully')
      loadOrganisation()
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 p-4 lg:p-8 lg:ml-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
        </main>
      </div>
    )
  }

  const canEdit = !isCompanyTrainer // Company trainers cannot edit

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 lg:ml-64">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-8">
            <Building2 className="w-8 h-8 text-yellow-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Organisation</h1>
              <p className="text-zinc-400">
                {isCompanyTrainer 
                  ? 'Your company branding (managed by company admin)'
                  : 'Manage your branding and organisation details'
                }
              </p>
            </div>
          </div>

          {/* Read-only notice for company trainers */}
          {isCompanyTrainer && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Lock className="w-5 h-5 text-blue-400" />
              <p className="text-blue-400 text-sm">
                These settings are managed by your company admin. Contact them to make changes.
              </p>
            </div>
          )}

          {/* Logo Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Logo</h2>
            
            <div className="flex items-center gap-6">
              {/* Logo Preview */}
              <div className="w-24 h-24 rounded-xl bg-zinc-800 border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden">
                {previewLogo ? (
                  <Image
                    src={previewLogo}
                    alt="Logo"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="w-8 h-8 text-zinc-600" />
                )}
              </div>

              {/* Upload Controls */}
              {canEdit && (
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      {previewLogo ? 'Change' : 'Upload'}
                    </button>
                    {previewLogo && (
                      <button
                        onClick={removeLogo}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-zinc-500 text-sm mt-2">
                    Recommended: Square image, at least 200x200px
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Organisation Details */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Organisation Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!canEdit}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">URL Slug</label>
                <div className="flex items-center">
                  <span className="text-zinc-500 mr-2">app.cmpdcollective.com/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    disabled={!canEdit}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Brand Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.brand_color}
                    onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                    disabled={!canEdit}
                    className="w-12 h-12 rounded-xl cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <input
                    type="text"
                    value={formData.brand_color}
                    onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })}
                    disabled={!canEdit}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving || uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {uploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
