'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { 
  Calendar, User, ChevronDown, Plus, GripVertical, Trash2, 
  Clock, ChevronRight, AlertCircle, Check, Loader2, ArrowLeft,
  X, Settings2, ChevronUp, Dumbbell
} from 'lucide-react'

interface Client {
  id: string
  full_name: string
  email: string
}

interface Program {
  id: string
  name: string
  category: string
  difficulty: string
  duration_weeks: number | null
}

interface ClientProgram {
  id: string
  client_id: string
  program_id: string
  program?: Program
  start_date: string
  end_date: string | null
  duration_weeks: number
  is_active: boolean
  order_index: number
  notes: string | null
}

interface ExerciseSet {
  id: string
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_seconds: number
  rest_bracket?: string
  notes: string
}

interface WorkoutExercise {
  id: string
  exercise_name: string
  order_index: number
  exercise_sets: ExerciseSet[]
}

interface ProgramWorkout {
  id: string
  name: string
  day_of_week: number | null
  order_index: number
  workout_exercises: WorkoutExercise[]
}

// Exercise-level customization (applies to all sets)
interface ExerciseCustomization {
  workout_exercise_id: string
  set_count: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket: string
}

const categoryColors: Record<string, string> = {
  strength: 'bg-blue-500',
  cardio: 'bg-green-500',
  hyrox: 'bg-yellow-500',
  hybrid: 'bg-purple-500',
  nutrition: 'bg-pink-500',
  recovery: 'bg-cyan-500',
}

function SchedulesPageContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const clientIdFromUrl = searchParams.get('client')

  const [clients, setClients] = useState<Client[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientPrograms, setClientPrograms] = useState<ClientProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)

  // Wizard state
  const [wizardStep, setWizardStep] = useState<'select' | 'customize'>('select')
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [assignDuration, setAssignDuration] = useState(4)
  const [phaseName, setPhaseName] = useState('')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [programWorkouts, setProgramWorkouts] = useState<ProgramWorkout[]>([])
  const [exerciseCustomizations, setExerciseCustomizations] = useState<Map<string, ExerciseCustomization>>(new Map())
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set())
  const [loadingWorkouts, setLoadingWorkouts] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [clientIdFromUrl])

  useEffect(() => {
    if (selectedClient) {
      loadClientPrograms(selectedClient.id)
    } else {
      setClientPrograms([])
    }
  }, [selectedClient])

  const loadInitialData = async () => {
    try {
      const [clientsRes, programsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').order('full_name'),
        supabase.from('programs').select('id, name, category, difficulty, duration_weeks').eq('is_active', true).order('name')
      ])

      const clientsList = clientsRes.data || []
      setClients(clientsList)
      setPrograms(programsRes.data || [])
      
      // Auto-select client if passed in URL
      if (clientIdFromUrl) {
        const clientFromUrl = clientsList.find(c => c.id === clientIdFromUrl)
        if (clientFromUrl) {
          setSelectedClient(clientFromUrl)
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadClientPrograms = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_programs')
        .select(`
          *,
          program:programs (id, name, category, difficulty, duration_weeks)
        `)
        .eq('client_id', clientId)
        .order('start_date', { ascending: true })

      if (error) throw error

      const programsWithDates = (data || []).map((cp, index) => ({
        ...cp,
        duration_weeks: cp.duration_weeks || cp.program?.duration_weeks || 4,
        order_index: index,
        end_date: cp.end_date || calculateEndDate(cp.start_date, cp.duration_weeks || cp.program?.duration_weeks || 4)
      }))

      setClientPrograms(programsWithDates)
    } catch (err) {
      console.error('Error loading client programs:', err)
    }
  }

  const calculateEndDate = (startDate: string, weeks: number): string => {
    const start = new Date(startDate)
    start.setDate(start.getDate() + (weeks * 7))
    return start.toISOString().split('T')[0]
  }

  const getNextStartDate = (): string => {
    if (clientPrograms.length === 0) {
      return new Date().toISOString().split('T')[0]
    }
    const lastProgram = clientPrograms[clientPrograms.length - 1]
    const endDate = lastProgram.end_date || calculateEndDate(lastProgram.start_date, lastProgram.duration_weeks)
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    return nextDay.toISOString().split('T')[0]
  }

  const openAddModal = () => {
    setSelectedProgram(null)
    setAssignDuration(4)
    setPhaseName('')
    setCustomStartDate(getNextStartDate())
    setWizardStep('select')
    setProgramWorkouts([])
    setExerciseCustomizations(new Map())
    setExpandedWorkouts(new Set())
    setShowAddModal(true)
  }

  const fetchProgramWorkouts = async (programId: string) => {
    setLoadingWorkouts(true)
    try {
      const { data: workouts, error } = await supabase
        .from('program_workouts')
        .select(`
          id,
          name,
          day_of_week,
          order_index,
          workout_exercises (
            id,
            exercise_name,
            order_index,
            exercise_sets (
              id,
              set_number,
              reps,
              intensity_type,
              intensity_value,
              rest_seconds,
              notes
            )
          )
        `)
        .eq('program_id', programId)
        .order('order_index')
      
      if (error) throw error
      
      const sortedWorkouts = (workouts || []).map(w => ({
        ...w,
        workout_exercises: (w.workout_exercises || [])
          .sort((a: WorkoutExercise, b: WorkoutExercise) => a.order_index - b.order_index)
          .map((ex: WorkoutExercise) => ({
            ...ex,
            exercise_sets: (ex.exercise_sets || [])
              .sort((a: ExerciseSet, b: ExerciseSet) => a.set_number - b.set_number)
          }))
      }))
      
      setProgramWorkouts(sortedWorkouts)
      
      // Initialize exercise customizations with defaults from first set
      const initialCustomizations = new Map<string, ExerciseCustomization>()
      sortedWorkouts.forEach(workout => {
        workout.workout_exercises.forEach((exercise: WorkoutExercise) => {
          const firstSet = exercise.exercise_sets[0]
          if (firstSet) {
            initialCustomizations.set(exercise.id, {
              workout_exercise_id: exercise.id,
              set_count: exercise.exercise_sets.length,
              reps: firstSet.reps,
              intensity_type: firstSet.intensity_type,
              intensity_value: firstSet.intensity_value,
              rest_bracket: firstSet.rest_bracket || `${firstSet.rest_seconds || 90}`
            })
          }
        })
      })
      setExerciseCustomizations(initialCustomizations)
      
      if (sortedWorkouts.length > 0) {
        setExpandedWorkouts(new Set([sortedWorkouts[0].id]))
      }
    } catch (err) {
      console.error('Failed to fetch program workouts:', err)
    } finally {
      setLoadingWorkouts(false)
    }
  }

  const proceedToCustomize = () => {
    if (!selectedProgram) return
    fetchProgramWorkouts(selectedProgram.id)
    setWizardStep('customize')
  }

  const updateExerciseCustomization = (exerciseId: string, field: keyof ExerciseCustomization, value: string | number) => {
    const existing = exerciseCustomizations.get(exerciseId)
    if (existing) {
      const updated = new Map(exerciseCustomizations)
      updated.set(exerciseId, { ...existing, [field]: value })
      setExerciseCustomizations(updated)
    }
  }

  const toggleWorkoutExpanded = (workoutId: string) => {
    const newExpanded = new Set(expandedWorkouts)
    if (newExpanded.has(workoutId)) {
      newExpanded.delete(workoutId)
    } else {
      newExpanded.add(workoutId)
    }
    setExpandedWorkouts(newExpanded)
  }

  const addProgram = async () => {
    if (!selectedClient || !selectedProgram) return

    setSaving(true)
    try {
      const startDate = customStartDate || getNextStartDate()
      const endDate = calculateEndDate(startDate, assignDuration)

      const { data: clientProgram, error } = await supabase
        .from('client_programs')
        .insert({
          client_id: selectedClient.id,
          program_id: selectedProgram.id,
          start_date: startDate,
          end_date: endDate,
          duration_weeks: assignDuration,
          phase_name: phaseName || null,
          is_active: clientPrograms.length === 0,
          current_week: 1,
        })
        .select(`
          *,
          program:programs (id, name, category, difficulty, duration_weeks)
        `)
        .single()

      if (error) throw error

      // Convert exercise-level customizations to set-level for database
      if (exerciseCustomizations.size > 0 && clientProgram) {
        const setsToInsert: {
          client_program_id: string
          workout_exercise_id: string
          set_number: number
          reps: string
          intensity_type: string
          intensity_value: string
          rest_bracket: string
          weight_type: string
          notes: string | null
        }[] = []
        
        exerciseCustomizations.forEach((custom) => {
          // Create sets based on set_count
          for (let i = 1; i <= custom.set_count; i++) {
            setsToInsert.push({
              client_program_id: clientProgram.id,
              workout_exercise_id: custom.workout_exercise_id,
              set_number: i,
              reps: custom.reps,
              intensity_type: custom.intensity_type,
              intensity_value: custom.intensity_value,
              rest_bracket: custom.rest_bracket,
              weight_type: 'freeweight',
              notes: null
            })
          }
        })
        
        if (setsToInsert.length > 0) {
          const { error: setsError } = await supabase
            .from('client_exercise_sets')
            .insert(setsToInsert)
          
          if (setsError) {
            console.error('Failed to save custom sets:', setsError)
          }
        }
      }

      setClientPrograms([...clientPrograms, { ...clientProgram, order_index: clientPrograms.length }])
      setShowAddModal(false)
    } catch (err) {
      console.error('Error adding program:', err)
    } finally {
      setSaving(false)
    }
  }

  const removeProgram = async (programId: string) => {
    if (!confirm('Remove this program from the schedule?')) return

    setSaving(true)
    try {
      await supabase.from('client_programs').delete().eq('id', programId)
      setClientPrograms(clientPrograms.filter(cp => cp.id !== programId))
      await recalculateDates(clientPrograms.filter(cp => cp.id !== programId))
    } catch (err) {
      console.error('Error removing program:', err)
    } finally {
      setSaving(false)
    }
  }

  const updateDuration = async (programId: string, newDuration: number) => {
    setSaving(true)
    try {
      const programIndex = clientPrograms.findIndex(cp => cp.id === programId)
      if (programIndex === -1) return

      const program = clientPrograms[programIndex]
      const newEndDate = calculateEndDate(program.start_date, newDuration)

      await supabase
        .from('client_programs')
        .update({ duration_weeks: newDuration, end_date: newEndDate })
        .eq('id', programId)

      const updated = [...clientPrograms]
      updated[programIndex] = { ...program, duration_weeks: newDuration, end_date: newEndDate }
      
      for (let i = programIndex + 1; i < updated.length; i++) {
        const prevEndDate = updated[i - 1].end_date!
        const newStartDate = new Date(prevEndDate)
        newStartDate.setDate(newStartDate.getDate() + 1)
        const startDateStr = newStartDate.toISOString().split('T')[0]
        const endDateStr = calculateEndDate(startDateStr, updated[i].duration_weeks)
        
        updated[i] = { ...updated[i], start_date: startDateStr, end_date: endDateStr }
        
        await supabase
          .from('client_programs')
          .update({ start_date: startDateStr, end_date: endDateStr })
          .eq('id', updated[i].id)
      }

      setClientPrograms(updated)
    } catch (err) {
      console.error('Error updating duration:', err)
    } finally {
      setSaving(false)
    }
  }

  const recalculateDates = async (programs: ClientProgram[]) => {
    let currentDate = programs.length > 0 ? programs[0].start_date : new Date().toISOString().split('T')[0]
    
    for (let i = 0; i < programs.length; i++) {
      const endDate = calculateEndDate(currentDate, programs[i].duration_weeks)
      programs[i] = { ...programs[i], start_date: currentDate, end_date: endDate }
      
      await supabase
        .from('client_programs')
        .update({ start_date: currentDate, end_date: endDate })
        .eq('id', programs[i].id)

      const nextDay = new Date(endDate)
      nextDay.setDate(nextDay.getDate() + 1)
      currentDate = nextDay.toISOString().split('T')[0]
    }

    setClientPrograms(programs)
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetId) {
      setDraggedItem(null)
      return
    }

    const draggedIndex = clientPrograms.findIndex(cp => cp.id === draggedItem)
    const targetIndex = clientPrograms.findIndex(cp => cp.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newPrograms = [...clientPrograms]
    const [removed] = newPrograms.splice(draggedIndex, 1)
    newPrograms.splice(targetIndex, 0, removed)

    await recalculateDates(newPrograms)
    setDraggedItem(null)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    })
  }

  const isCurrentProgram = (program: ClientProgram) => {
    const today = new Date().toISOString().split('T')[0]
    return program.start_date <= today && (!program.end_date || program.end_date >= today)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Program Scheduler</h1>
        <p className="text-zinc-400 mt-1">Schedule and manage client training programs</p>
      </div>

      {/* Client Selector */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-zinc-400 mb-3">Select Client</label>
        <div className="relative max-w-md">
          <input
            type="text"
            value={selectedClient ? (selectedClient.full_name || selectedClient.email) : clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value)
              setSelectedClient(null)
              setShowClientDropdown(true)
            }}
            onFocus={() => setShowClientDropdown(true)}
            placeholder="Search clients..."
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
          />
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
          
          {showClientDropdown && (
            <div className="absolute z-50 mt-2 w-full bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {clients
                .filter(c => {
                  const search = clientSearch.toLowerCase()
                  return (c.full_name?.toLowerCase().includes(search) || c.email.toLowerCase().includes(search))
                })
                .map(client => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClient(client)
                      setClientSearch('')
                      setShowClientDropdown(false)
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-zinc-700 transition-colors flex items-center justify-between ${
                      selectedClient?.id === client.id ? 'bg-yellow-400/10 text-yellow-400' : 'text-white'
                    }`}
                  >
                    <div>
                      <p className="font-medium">{client.full_name || 'No name'}</p>
                      <p className="text-sm text-zinc-500">{client.email}</p>
                    </div>
                    {selectedClient?.id === client.id && <Check className="w-4 h-4" />}
                  </button>
                ))}
              {clients.filter(c => {
                const search = clientSearch.toLowerCase()
                return (c.full_name?.toLowerCase().includes(search) || c.email.toLowerCase().includes(search))
              }).length === 0 && (
                <p className="px-4 py-3 text-zinc-500 text-center">No clients found</p>
              )}
            </div>
          )}
        </div>
        {/* Click outside to close */}
        {showClientDropdown && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowClientDropdown(false)}
          />
        )}
      </div>

      {/* Program Timeline */}
      {selectedClient && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-400/10 flex items-center justify-center">
                <User className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{selectedClient.full_name || 'Client'}</h2>
                <p className="text-sm text-zinc-500">{selectedClient.email}</p>
              </div>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Program
            </button>
          </div>

          {clientPrograms.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl">
              <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-zinc-400 mb-2">No programs scheduled</h3>
              <p className="text-zinc-500 text-sm mb-4">Add a program to start building this client&apos;s schedule</p>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Program
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {clientPrograms.map((cp, index) => {
                const isCurrent = isCurrentProgram(cp)
                const isPast = cp.end_date && cp.end_date < new Date().toISOString().split('T')[0]
                
                return (
                  <div
                    key={cp.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, cp.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, cp.id)}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-move ${
                      draggedItem === cp.id 
                        ? 'opacity-50 border-yellow-400' 
                        : isCurrent 
                          ? 'bg-yellow-400/10 border-yellow-400/30' 
                          : isPast
                            ? 'bg-zinc-800/30 border-zinc-800 opacity-60'
                            : 'bg-zinc-800/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-zinc-600 cursor-grab">
                      <GripVertical className="w-5 h-5" />
                    </div>

                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isCurrent ? 'bg-yellow-400 text-black' : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${isCurrent ? 'text-white' : 'text-zinc-300'}`}>
                          {cp.program?.name || 'Unknown Program'}
                        </h3>
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-yellow-400 text-black text-xs font-bold rounded-full">
                            CURRENT
                          </span>
                        )}
                        {isPast && (
                          <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-xs font-medium rounded-full">
                            COMPLETED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(cp.start_date)} → {cp.end_date ? formatDate(cp.end_date) : '...'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                          categoryColors[cp.program?.category || 'strength']
                        } bg-opacity-20 text-white`}>
                          {cp.program?.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-zinc-500" />
                      <select
                        value={cp.duration_weeks}
                        onChange={(e) => updateDuration(cp.id, parseInt(e.target.value))}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(w => (
                          <option key={w} value={w}>{w} week{w !== 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => removeProgram(cp.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}

              <div className="mt-6 pt-6 border-t border-zinc-800">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Total scheduled:</span>
                  <span className="text-white font-medium">
                    {clientPrograms.reduce((sum, cp) => sum + cp.duration_weeks, 0)} weeks
                    ({clientPrograms.length} program{clientPrograms.length !== 1 ? 's' : ''})
                  </span>
                </div>
                {clientPrograms.length > 0 && clientPrograms[clientPrograms.length - 1].end_date && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-zinc-500">Schedule ends:</span>
                    <span className="text-white font-medium">
                      {formatDate(clientPrograms[clientPrograms.length - 1].end_date!)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Program Modal - Wizard */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl w-full ${wizardStep === 'customize' ? 'max-w-3xl max-h-[90vh] overflow-hidden flex flex-col' : 'max-w-lg'}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                {wizardStep === 'customize' && (
                  <button 
                    onClick={() => setWizardStep('select')} 
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-zinc-400" />
                  </button>
                )}
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {wizardStep === 'select' ? 'Add Program to Schedule' : 'Customize Exercises'}
                  </h3>
                  <p className="text-sm text-zinc-500">
                    {wizardStep === 'select' 
                      ? `Starting ${new Date(customStartDate || getNextStartDate()).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}`
                      : selectedProgram?.name
                    }
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            {/* Step 1: Select Program */}
            {wizardStep === 'select' && (
              <>
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Select Program</label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {programs.map(program => (
                        <div
                          key={program.id}
                          onClick={() => {
                            setSelectedProgram(program)
                            if (program.duration_weeks) setAssignDuration(program.duration_weeks)
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedProgram?.id === program.id
                              ? 'border-yellow-400 bg-yellow-400/10'
                              : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryColors[program.category]} bg-opacity-20`}>
                            <Dumbbell className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-white">{program.name}</p>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              <span className="capitalize">{program.category}</span>
                              <span>•</span>
                              <span className="capitalize">{program.difficulty}</span>
                            </div>
                          </div>
                          {selectedProgram?.id === program.id && (
                            <Check className="w-5 h-5 text-yellow-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedProgram && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">
                          Phase Name <span className="text-zinc-600">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={phaseName}
                          onChange={(e) => setPhaseName(e.target.value)}
                          placeholder="e.g., Phase 1: Hypertrophy"
                          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Start Date</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Duration</label>
                        <div className="grid grid-cols-5 gap-2">
                          {[2, 3, 4, 6, 8].map(w => (
                            <button
                              key={w}
                              onClick={() => setAssignDuration(w)}
                              className={`py-2 rounded-lg font-medium transition-colors ${
                                assignDuration === w
                                  ? 'bg-yellow-400 text-black'
                                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                              }`}
                            >
                              {w}wk
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-zinc-800">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={proceedToCustomize}
                    disabled={!selectedProgram}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-medium rounded-xl transition-colors"
                  >
                    <Settings2 className="w-4 h-4" />
                    Customize
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
            
            {/* Step 2: Customize Exercises (Grouped) */}
            {wizardStep === 'customize' && (
              <>
                <div className="p-6 overflow-y-auto flex-1">
                  {loadingWorkouts ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
                    </div>
                  ) : programWorkouts.length === 0 ? (
                    <div className="text-center py-12">
                      <Dumbbell className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                      <p className="text-zinc-400">This program has no workouts yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {phaseName && (
                        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-4 py-3">
                          <p className="text-sm text-yellow-400 font-medium">{phaseName}</p>
                          <p className="text-xs text-zinc-400">{assignDuration} weeks</p>
                        </div>
                      )}
                      
                      {programWorkouts.map(workout => (
                        <div key={workout.id} className="border border-zinc-800 rounded-xl overflow-hidden">
                          <button
                            onClick={() => toggleWorkoutExpanded(workout.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                                <Dumbbell className="w-5 h-5 text-zinc-400" />
                              </div>
                              <div className="text-left">
                                <p className="font-medium text-white">{workout.name}</p>
                                <p className="text-xs text-zinc-500">{workout.workout_exercises.length} exercises</p>
                              </div>
                            </div>
                            {expandedWorkouts.has(workout.id) ? (
                              <ChevronUp className="w-5 h-5 text-zinc-500" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-zinc-500" />
                            )}
                          </button>
                          
                          {expandedWorkouts.has(workout.id) && (
                            <div className="border-t border-zinc-800 divide-y divide-zinc-800/50">
                              {workout.workout_exercises.map((exercise: WorkoutExercise, exIdx: number) => {
                                const custom = exerciseCustomizations.get(exercise.id)
                                return (
                                  <div key={exercise.id} className="p-4 hover:bg-zinc-800/20">
                                    <div className="flex items-center gap-3 mb-3">
                                      <span className="w-6 h-6 rounded bg-yellow-400/10 text-yellow-400 flex items-center justify-center text-xs font-bold">
                                        {exIdx + 1}
                                      </span>
                                      <span className="text-white font-medium">{exercise.exercise_name}</span>
                                    </div>
                                    
                                    {/* Grouped controls */}
                                    <div className="grid grid-cols-4 gap-3">
                                      {/* Sets */}
                                      <div>
                                        <label className="block text-xs text-zinc-500 mb-1">Sets</label>
                                        <input
                                          type="number"
                                          min="1"
                                          max="10"
                                          value={custom?.set_count || exercise.exercise_sets.length}
                                          onChange={(e) => updateExerciseCustomization(exercise.id, 'set_count', parseInt(e.target.value) || 1)}
                                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                        />
                                      </div>
                                      
                                      {/* Reps */}
                                      <div>
                                        <label className="block text-xs text-zinc-500 mb-1">Reps</label>
                                        <input
                                          type="text"
                                          value={custom?.reps || ''}
                                          onChange={(e) => updateExerciseCustomization(exercise.id, 'reps', e.target.value)}
                                          placeholder="8-12"
                                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                        />
                                      </div>
                                      
                                      {/* Intensity */}
                                      <div>
                                        <label className="block text-xs text-zinc-500 mb-1">Intensity</label>
                                        <div className="flex gap-1 items-center">
                                          <select
                                            value={custom?.intensity_type || 'rir'}
                                            onChange={(e) => updateExerciseCustomization(exercise.id, 'intensity_type', e.target.value)}
                                            className="flex-1 px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                          >
                                            <option value="rir">RIR</option>
                                            <option value="rpe">RPE</option>
                                            <option value="percentage">%</option>
                                            <option value="time">Time</option>
                                            <option value="failure">Failure</option>
                                          </select>
                                          {custom?.intensity_type !== 'failure' && (
                                            <>
                                              <input
                                                type="text"
                                                value={custom?.intensity_value || ''}
                                                onChange={(e) => updateExerciseCustomization(exercise.id, 'intensity_value', e.target.value)}
                                                placeholder={custom?.intensity_type === 'time' ? '30' : '2'}
                                                className="w-14 px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                              />
                                              {custom?.intensity_type === 'time' && (
                                                <span className="text-xs text-zinc-500">sec</span>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Rest */}
                                      <div>
                                        <label className="block text-xs text-zinc-500 mb-1">Rest (s)</label>
                                        <input
                                          type="text"
                                          value={custom?.rest_bracket || ''}
                                          onChange={(e) => updateExerciseCustomization(exercise.id, 'rest_bracket', e.target.value)}
                                          placeholder="90-120"
                                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between gap-3 p-6 border-t border-zinc-800 flex-shrink-0">
                  <button
                    onClick={() => setWizardStep('select')}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={addProgram}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-medium rounded-xl transition-colors"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Assign Program
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// Wrap in Suspense for useSearchParams
export default function SchedulesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-yellow-400" /></div>}>
      <SchedulesPageContent />
    </Suspense>
  )
}
