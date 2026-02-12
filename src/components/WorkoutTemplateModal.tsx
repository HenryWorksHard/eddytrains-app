'use client'

import React, { useState, useEffect } from 'react'
import { X, Save, FileDown, Trash2, Loader2, Layers, Search } from 'lucide-react'

interface WorkoutTemplate {
  id: string
  name: string
  description: string | null
  category: string
  workout_data: any
  created_at: string
}

interface WorkoutTemplateModalProps {
  mode: 'save' | 'load'
  workoutData?: any // The workout to save
  category?: string
  onClose: () => void
  onLoad?: (template: WorkoutTemplate) => void
  onSave?: (name: string, description: string) => Promise<void>
}

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hyrox', label: 'Hyrox' },
  { value: 'hybrid', label: 'Hybrid' },
]

export default function WorkoutTemplateModal({
  mode,
  workoutData,
  category = 'strength',
  onClose,
  onLoad,
  onSave,
}: WorkoutTemplateModalProps) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Save mode state
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')

  // Load templates
  useEffect(() => {
    if (mode === 'load') {
      fetchTemplates()
    } else {
      setLoading(false)
    }
  }, [mode])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/templates')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTemplates(data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError('Please enter a template name')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          category,
          workoutData,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (onSave) {
        await onSave(templateName, templateDescription)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return

    try {
      const res = await fetch(`/api/templates?id=${templateId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setTemplates(templates.filter((t) => t.id !== templateId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template')
    }
  }

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesCategory =
      selectedCategory === 'all' || t.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const formatExerciseCount = (data: any) => {
    if (!data?.exercises) return '0 exercises'
    const count = data.exercises.length
    return `${count} exercise${count !== 1 ? 's' : ''}`
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center">
              {mode === 'save' ? (
                <Save className="w-5 h-5 text-yellow-400" />
              ) : (
                <FileDown className="w-5 h-5 text-yellow-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {mode === 'save' ? 'Save as Template' : 'Load Template'}
              </h2>
              <p className="text-sm text-zinc-400">
                {mode === 'save'
                  ? 'Save this workout configuration for reuse'
                  : 'Choose a template to load'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {mode === 'save' ? (
            /* Save Mode Form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="e.g., Push Day - Hypertrophy"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                  rows={3}
                  placeholder="Brief description of this workout template..."
                />
              </div>
              <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
                  <Layers className="w-4 h-4" />
                  <span>Template Preview</span>
                </div>
                <div className="text-white font-medium">
                  {workoutData?.name || 'Untitled Workout'}
                </div>
                <div className="text-sm text-zinc-500">
                  {formatExerciseCount(workoutData)} • {category}
                </div>
              </div>
            </div>
          ) : (
            /* Load Mode List */
            <div className="space-y-4">
              {/* Search & Filter */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="Search templates..."
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Templates List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">
                    {templates.length === 0
                      ? 'No templates saved yet'
                      : 'No templates match your search'}
                  </p>
                  {templates.length === 0 && (
                    <p className="text-zinc-500 text-sm mt-1">
                      Save a workout as a template to reuse it later
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl hover:border-yellow-400/50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => onLoad && onLoad(template)}
                        >
                          <div className="font-medium text-white group-hover:text-yellow-400 transition-colors">
                            {template.name}
                          </div>
                          {template.description && (
                            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                            <span className="px-2 py-0.5 bg-zinc-700 rounded-full capitalize">
                              {template.category}
                            </span>
                            <span>{formatExerciseCount(template.workout_data)}</span>
                            <span>
                              {new Date(template.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(template.id)
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {mode === 'save' && (
          <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !templateName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black rounded-xl font-medium transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Template
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
