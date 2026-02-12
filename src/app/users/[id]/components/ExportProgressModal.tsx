'use client'

import { useState, useEffect } from 'react'
import { X, Download, Loader2, FileText, Calendar } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportProgressModalProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
  clientName: string
}

interface ExportOptions {
  streak: boolean
  tonnage: boolean
  progression: boolean
  oneRMs: boolean
  progressPictures: boolean
}

type DateRange = 'week' | 'month' | '3months' | '6months' | 'year' | 'all'

export default function ExportProgressModal({ isOpen, onClose, clientId, clientName }: ExportProgressModalProps) {
  const [options, setOptions] = useState<ExportOptions>({
    streak: true,
    tonnage: true,
    progression: true,
    oneRMs: true,
    progressPictures: false,
  })
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [exporting, setExporting] = useState(false)
  const [availableExercises, setAvailableExercises] = useState<string[]>([])
  const [selectedExercises, setSelectedExercises] = useState<string[]>([])
  const [loadingExercises, setLoadingExercises] = useState(false)

  // Fetch client's exercises when modal opens
  useEffect(() => {
    if (isOpen && clientId) {
      setLoadingExercises(true)
      fetch(`/api/users/${clientId}/exercises`)
        .then(res => res.json())
        .then(data => {
          const exercises = (data.exercises || []).map((e: { name: string }) => e.name)
          setAvailableExercises(exercises)
          setSelectedExercises(exercises) // Select all by default
        })
        .catch(err => {
          console.error('Failed to fetch exercises:', err)
          setAvailableExercises([])
          setSelectedExercises([])
        })
        .finally(() => setLoadingExercises(false))
    }
  }, [isOpen, clientId])

  const allSelected = availableExercises.length > 0 && selectedExercises.length === availableExercises.length
  const noneSelected = selectedExercises.length === 0

  const toggleExercise = (exercise: string) => {
    setSelectedExercises(prev => 
      prev.includes(exercise) 
        ? prev.filter(e => e !== exercise)
        : [...prev, exercise]
    )
  }

  const toggleAllExercises = () => {
    if (allSelected) {
      setSelectedExercises([])
    } else {
      setSelectedExercises([...availableExercises])
    }
  }

  if (!isOpen) return null

  const getDateRangeStart = (range: DateRange): Date => {
    const now = new Date()
    switch (range) {
      case 'week':
        return new Date(now.setDate(now.getDate() - 7))
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1))
      case '3months':
        return new Date(now.setMonth(now.getMonth() - 3))
      case '6months':
        return new Date(now.setMonth(now.getMonth() - 6))
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1))
      case 'all':
        return new Date('2020-01-01')
    }
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const handleExport = async () => {
    setExporting(true)
    
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPos = 20

      // Header
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.text('Progress Report', pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      doc.setFontSize(14)
      doc.setFont('helvetica', 'normal')
      doc.text(clientName, pageWidth / 2, yPos, { align: 'center' })
      yPos += 8

      doc.setFontSize(10)
      doc.setTextColor(100)
      const dateRangeLabel = dateRange === 'all' ? 'All Time' : `Last ${dateRange === 'week' ? 'Week' : dateRange === 'month' ? 'Month' : dateRange === '3months' ? '3 Months' : dateRange === '6months' ? '6 Months' : 'Year'}`
      doc.text(`Report Period: ${dateRangeLabel}`, pageWidth / 2, yPos, { align: 'center' })
      doc.text(`Generated: ${formatDate(new Date())}`, pageWidth / 2, yPos + 5, { align: 'center' })
      doc.setTextColor(0)
      yPos += 20

      // Streak Section
      if (options.streak) {
        try {
          const streakRes = await fetch(`/api/users/${clientId}/streak`)
          const { streak } = await streakRes.json()
          
          if (streak) {
            doc.setFontSize(16)
            doc.setFont('helvetica', 'bold')
            doc.text('Workout Streak', 14, yPos)
            yPos += 8

            autoTable(doc, {
              startY: yPos,
              head: [['Current Streak', 'Longest Streak', 'Last Workout']],
              body: [[
                `${streak.current_streak} days`,
                `${streak.longest_streak} days`,
                streak.last_workout_date ? formatDate(new Date(streak.last_workout_date)) : 'N/A'
              ]],
              theme: 'grid',
              headStyles: { fillColor: [250, 204, 21], textColor: [0, 0, 0], fontStyle: 'bold' },
              styles: { halign: 'center' },
              margin: { left: 14, right: 14 }
            })
            yPos = (doc as any).lastAutoTable.finalY + 15
          }
        } catch (err) {
          console.error('Failed to fetch streak:', err)
        }
      }

      // Tonnage Section
      if (options.tonnage) {
        try {
          const periods = ['day', 'week', 'month', 'year']
          const tonnageData: { period: string; value: number }[] = []
          
          for (const period of periods) {
            const res = await fetch(`/api/users/${clientId}/tonnage?period=${period}`)
            const { tonnage } = await res.json()
            tonnageData.push({ 
              period: period.charAt(0).toUpperCase() + period.slice(1), 
              value: tonnage || 0 
            })
          }

          doc.setFontSize(16)
          doc.setFont('helvetica', 'bold')
          doc.text('Training Tonnage', 14, yPos)
          yPos += 8

          autoTable(doc, {
            startY: yPos,
            head: [['Period', 'Total Volume (kg)']],
            body: tonnageData.map(t => [t.period, t.value.toLocaleString()]),
            theme: 'grid',
            headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { halign: 'center' },
            margin: { left: 14, right: 14 }
          })
          yPos = (doc as any).lastAutoTable.finalY + 15
        } catch (err) {
          console.error('Failed to fetch tonnage:', err)
        }
      }

      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      // 1RM Section
      if (options.oneRMs) {
        try {
          const res = await fetch(`/api/users/${clientId}/1rms`)
          const { oneRMs } = await res.json()
          
          if (oneRMs && oneRMs.length > 0) {
            doc.setFontSize(16)
            doc.setFont('helvetica', 'bold')
            doc.text('One Rep Maxes (1RM)', 14, yPos)
            yPos += 8

            autoTable(doc, {
              startY: yPos,
              head: [['Exercise', 'Weight (kg)', 'Last Updated']],
              body: oneRMs.map((rm: any) => [
                rm.exercise_name,
                rm.weight_kg,
                rm.updated_at ? formatDate(new Date(rm.updated_at)) : 'N/A'
              ]),
              theme: 'grid',
              headStyles: { fillColor: [250, 204, 21], textColor: [0, 0, 0], fontStyle: 'bold' },
              margin: { left: 14, right: 14 }
            })
            yPos = (doc as any).lastAutoTable.finalY + 15
          }
        } catch (err) {
          console.error('Failed to fetch 1RMs:', err)
        }
      }

      // Check if we need a new page
      if (yPos > 200) {
        doc.addPage()
        yPos = 20
      }

      // Exercise Progression Section
      if (options.progression && selectedExercises.length > 0) {
        for (const exercise of selectedExercises) {
          try {
            // Check if we need a new page
            if (yPos > 200) {
              doc.addPage()
              yPos = 20
            }
            
            const res = await fetch(`/api/users/${clientId}/progression?exercise=${encodeURIComponent(exercise)}&period=${dateRange}`)
            const { progression } = await res.json()
            
            if (progression && progression.length > 0) {
              doc.setFontSize(16)
              doc.setFont('helvetica', 'bold')
              doc.text(`Exercise Progression: ${exercise}`, 14, yPos)
              yPos += 8

              autoTable(doc, {
                startY: yPos,
                head: [['Date', 'Weight (kg)', 'Reps']],
                body: progression.map((p: any) => [
                  formatDate(new Date(p.date)),
                  p.weight,
                  p.reps
                ]),
                theme: 'grid',
                headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
                margin: { left: 14, right: 14 }
              })
              yPos = (doc as any).lastAutoTable.finalY + 15
            }
          } catch (err) {
            console.error(`Failed to fetch progression for ${exercise}:`, err)
          }
        }
      }

      // Footer on each page
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })
        doc.text('Generated by CMPD Fitness', pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' })
      }

      // Save the PDF
      const fileName = `${clientName.replace(/\s+/g, '_')}_Progress_Report_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
      
      onClose()
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const toggleOption = (key: keyof ExportOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const hasAnyOption = Object.values(options).some(v => v) && 
    (!options.progression || selectedExercises.length > 0)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-yellow-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Export Progress Report</h3>
              <p className="text-sm text-zinc-500">{clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Date Range */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3">
              <Calendar className="w-4 h-4" />
              Time Period
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: '3months', label: '3 Months' },
                { value: '6months', label: '6 Months' },
                { value: 'year', label: 'Year' },
                { value: 'all', label: 'All Time' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDateRange(value as DateRange)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === value
                      ? 'bg-yellow-400 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Data Selection */}
          <div>
            <label className="text-sm font-medium text-zinc-400 mb-3 block">Include in Report</label>
            <div className="space-y-2">
              {[
                { key: 'streak', label: 'Workout Streak', desc: 'Current and longest streak' },
                { key: 'tonnage', label: 'Training Tonnage', desc: 'Total volume lifted' },
                { key: 'oneRMs', label: 'One Rep Maxes', desc: 'All recorded 1RMs' },
                { key: 'progression', label: 'Exercise Progression', desc: 'Weight progress over time' },
                { key: 'progressPictures', label: 'Progress Pictures', desc: 'Coming soon', disabled: true },
              ].map(({ key, label, desc, disabled }) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                    disabled 
                      ? 'bg-zinc-800/30 border-zinc-800 opacity-50 cursor-not-allowed'
                      : options[key as keyof ExportOptions]
                        ? 'bg-yellow-400/10 border-yellow-400/30'
                        : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={options[key as keyof ExportOptions]}
                    onChange={() => !disabled && toggleOption(key as keyof ExportOptions)}
                    disabled={disabled}
                    className="w-4 h-4 rounded border-zinc-600 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-0 bg-zinc-700"
                  />
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{label}</p>
                    <p className="text-zinc-500 text-xs">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Exercise Selection for Progression */}
          {options.progression && (
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Progression Exercises</label>
              {loadingExercises ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                  <span className="ml-2 text-zinc-500 text-sm">Loading exercises...</span>
                </div>
              ) : availableExercises.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-zinc-500 text-sm">No exercises found for this client.</p>
                  <p className="text-zinc-600 text-xs mt-1">Assign a program with exercises first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Select All */}
                  <label
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                      allSelected
                        ? 'bg-indigo-400/10 border-indigo-400/30'
                        : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAllExercises}
                      className="w-4 h-4 rounded border-zinc-600 text-indigo-400 focus:ring-indigo-400 focus:ring-offset-0 bg-zinc-700"
                    />
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">Select All</p>
                      <p className="text-zinc-500 text-xs">{selectedExercises.length} of {availableExercises.length} selected</p>
                    </div>
                  </label>

                  {/* Individual Exercises */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg">
                    {availableExercises.map((exercise) => (
                      <label
                        key={exercise}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          selectedExercises.includes(exercise)
                            ? 'bg-indigo-400/10 border-indigo-400/30'
                            : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedExercises.includes(exercise)}
                          onChange={() => toggleExercise(exercise)}
                          className="w-4 h-4 rounded border-zinc-600 text-indigo-400 focus:ring-indigo-400 focus:ring-offset-0 bg-zinc-700"
                        />
                        <span className="text-white text-sm">{exercise}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-zinc-800 sticky bottom-0 bg-zinc-900">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || !hasAnyOption}
            className="flex items-center gap-2 px-6 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-medium rounded-xl transition-colors"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
