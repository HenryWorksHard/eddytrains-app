'use client'

import React, { useState, useMemo } from 'react'
import { Plus, Minus, Trash2, GripVertical, Dumbbell, ChevronDown, ChevronUp, Copy, Settings2, Layers, RefreshCw } from 'lucide-react'
import ExerciseSelector from './ExerciseSelector'
import WorkoutTemplateModal from './WorkoutTemplateModal'
import exercisesData from '@/data/exercises.json'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ExerciseSet {
  id: string
  setNumber: number
  reps: string
  intensityType: 'percentage' | 'rir' | 'rpe' | 'failure' | 'time'
  intensityValue: string
  restSeconds: number
  restBracket: string
  weightType: string
  notes: string
  // Cardio-specific fields
  cardioType?: 'duration' | 'distance' | 'calories' | 'intervals' | 'steps'
  cardioValue?: string // e.g., "20:00", "5km", "300cal", "10 rounds"
  cardioUnit?: string // e.g., "min", "km", "m", "cal", "rounds"
  heartRateZone?: 1 | 2 | 3 | 4 | 5
  pace?: string // e.g., "5:00/km"
  intervals?: number // number of intervals for EMOM/HIIT
  workTime?: string // work period (e.g., "40s")
  restTime?: string // rest period (e.g., "20s")
  // Hyrox-specific fields
  hyroxStation?: string // station type (skierg, sled_push, etc.)
  hyroxDistance?: string // distance or reps for the station
  hyroxUnit?: string // m, reps
  hyroxTargetTime?: string // target completion time (e.g., "4:30")
  hyroxWeightClass?: string // pro_male, open_female, etc.
  hyroxCustomWeight?: string // for custom weight class
  // Hybrid-specific fields
  hybridMode?: 'strength' | 'cardio' // which mode this exercise uses
}

const weightTypes = [
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'freeweight', label: 'Freeweight (DB/BB)' },
  { id: 'machine', label: 'Machine' },
  { id: 'cable', label: 'Cable' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'weight_belt', label: 'Weight Belt' },
  { id: 'smith_machine', label: 'Smith Machine' },
  { id: 'plate_loaded', label: 'Plate Loaded' },
  { id: 'resistance_band', label: 'Resistance Band' },
  { id: 'medicine_ball', label: 'Medicine Ball' },
  { id: 'trx', label: 'TRX/Suspension' },
]

const restBrackets = [
  { value: '30-60', label: '30-60s' },
  { value: '60-90', label: '60-90s' },
  { value: '90-120', label: '90-120s' },
  { value: '120-180', label: '2-3min' },
  { value: '180-300', label: '3-5min' },
]

// Cardio-specific options
const cardioTypes = [
  { value: 'duration', label: 'Duration', icon: 'D' },
  { value: 'distance', label: 'Distance', icon: 'KM' },
  { value: 'calories', label: 'Calories', icon: 'CAL' },
  { value: 'intervals', label: 'Intervals', icon: 'INT' },
  { value: 'steps', label: 'Steps', icon: '#' },
]

// Hyrox-specific options
const hyroxStations = [
  { value: 'run', label: '1km Run', icon: 'RUN', defaultDistance: '1000', defaultUnit: 'm' },
  { value: 'skierg', label: 'SkiErg', icon: 'SKI', defaultDistance: '1000', defaultUnit: 'm' },
  { value: 'sled_push', label: 'Sled Push', icon: 'PSH', defaultDistance: '50', defaultUnit: 'm' },
  { value: 'sled_pull', label: 'Sled Pull', icon: 'PLL', defaultDistance: '50', defaultUnit: 'm' },
  { value: 'burpee_broad_jump', label: 'Burpee Broad Jump', icon: 'BBJ', defaultDistance: '80', defaultUnit: 'm' },
  { value: 'row', label: 'Rowing', icon: 'ROW', defaultDistance: '1000', defaultUnit: 'm' },
  { value: 'farmers_carry', label: 'Farmers Carry', icon: 'FC', defaultDistance: '200', defaultUnit: 'm' },
  { value: 'sandbag_lunges', label: 'Sandbag Lunges', icon: 'SBL', defaultDistance: '100', defaultUnit: 'm' },
  { value: 'wall_balls', label: 'Wall Balls', icon: 'WB', defaultDistance: '100', defaultUnit: 'reps' },
]

const hyroxWeightClasses = [
  { value: 'pro_male', label: 'Pro Male', weights: { sled: '152kg', sandbag: '30kg', wallball: '9kg', farmers: '2x32kg' } },
  { value: 'pro_female', label: 'Pro Female', weights: { sled: '102kg', sandbag: '20kg', wallball: '6kg', farmers: '2x24kg' } },
  { value: 'open_male', label: 'Open Male', weights: { sled: '152kg', sandbag: '20kg', wallball: '6kg', farmers: '2x24kg' } },
  { value: 'open_female', label: 'Open Female', weights: { sled: '102kg', sandbag: '10kg', wallball: '4kg', farmers: '2x16kg' } },
  { value: 'doubles_male', label: 'Doubles Male', weights: { sled: '152kg', sandbag: '20kg', wallball: '6kg', farmers: '2x24kg' } },
  { value: 'doubles_female', label: 'Doubles Female', weights: { sled: '102kg', sandbag: '10kg', wallball: '4kg', farmers: '2x16kg' } },
  { value: 'custom', label: 'Custom', weights: {} },
]

// Hybrid workout modes
const hybridModes = [
  { value: 'strength', label: 'Strength', icon: 'S' },
  { value: 'cardio', label: 'Cardio', icon: 'C' },
]

const heartRateZones = [
  { value: 1, label: 'Zone 1', desc: 'Recovery (50-60%)', color: 'text-blue-400' },
  { value: 2, label: 'Zone 2', desc: 'Aerobic (60-70%)', color: 'text-green-400' },
  { value: 3, label: 'Zone 3', desc: 'Tempo (70-80%)', color: 'text-yellow-400' },
  { value: 4, label: 'Zone 4', desc: 'Threshold (80-90%)', color: 'text-orange-400' },
  { value: 5, label: 'Zone 5', desc: 'Max (90-100%)', color: 'text-red-400' },
]

const distanceUnits = [
  { value: 'm', label: 'meters' },
  { value: 'km', label: 'km' },
  { value: 'mi', label: 'miles' },
  { value: 'cal', label: 'calories' },
]

function getDefaultWeightType(exerciseId: string): string {
  const exercise = exercisesData.exercises.find((e: { id: string }) => e.id === exerciseId)
  if (!exercise) return 'freeweight'
  
  const equipment = exercise.equipment || []
  
  if (equipment.includes('barbell')) return 'plate_loaded'
  if (equipment.includes('smith')) return 'smith_machine'
  if (equipment.includes('dumbbell')) return 'freeweight'
  if (equipment.includes('cable')) return 'cable'
  if (equipment.includes('machine')) return 'machine'
  if (equipment.includes('kettlebell')) return 'kettlebell'
  if (equipment.includes('bands')) return 'resistance_band'
  if (equipment.includes('trx')) return 'trx'
  if (equipment.includes('medicineball')) return 'medicine_ball'
  if (equipment.includes('bodyweight') || equipment.includes('pullupbar')) return 'bodyweight'
  
  return 'freeweight'
}

interface WorkoutExercise {
  id: string
  exerciseId: string
  exerciseName: string
  category: string
  order: number
  sets: ExerciseSet[]
  notes: string
  supersetGroup?: string
}

export interface WorkoutFinisher {
  id: string
  name: string
  category: 'strength' | 'cardio' | 'hyrox' | 'hybrid'
  exercises: WorkoutExercise[]
  notes: string
  // EMOM settings (for cardio/hyrox/hybrid finishers)
  isEmom?: boolean
  emomInterval?: number
  // Superset mode (all exercises done as one superset)
  isSuperset?: boolean
}

export interface Workout {
  id: string
  name: string
  dayOfWeek: number | null
  order: number
  exercises: WorkoutExercise[]
  notes: string
  finisher?: WorkoutFinisher
  // EMOM settings (for cardio/hyrox/hybrid)
  isEmom?: boolean
  emomInterval?: number // interval in seconds (e.g., 60 = every minute)
  // Warmup & Recovery (optional)
  warmupExercises?: WorkoutExercise[]
  recoveryNotes?: string
  // Week number for multi-week programs
  weekNumber: number
}

interface WorkoutBuilderProps {
  workouts: Workout[]
  onChange: (workouts: Workout[]) => void
  programType?: string // 'strength' | 'cardio' | 'hyrox' | 'hybrid'
}

const daysOfWeek = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

const finisherCategories = [
  { value: 'strength', label: 'Strength', icon: 'S', color: 'blue' },
  { value: 'cardio', label: 'Cardio', icon: 'C', color: 'green' },
  { value: 'hyrox', label: 'Hyrox', icon: 'H', color: 'orange' },
  { value: 'hybrid', label: 'Hybrid', icon: 'HY', color: 'purple' },
]

const intensityTypes = exercisesData.intensityTypes

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

function createDefaultSet(setNumber: number, weightType: string = 'freeweight', programType: string = 'strength'): ExerciseSet {
  if (programType === 'cardio') {
    return {
      id: generateId(),
      setNumber,
      reps: '1', // For cardio, typically 1 "round" or interval
      intensityType: 'rpe',
      intensityValue: '',
      restSeconds: 60,
      restBracket: '60-90',
      weightType: 'bodyweight',
      notes: '',
      cardioType: 'duration',
      cardioValue: '20',
      cardioUnit: 'min',
      heartRateZone: 2,
    }
  }
  
  if (programType === 'hyrox') {
    return {
      id: generateId(),
      setNumber,
      reps: '1',
      intensityType: 'rpe',
      intensityValue: '',
      restSeconds: 0,
      restBracket: '30-60',
      weightType: 'bodyweight',
      notes: '',
      hyroxStation: 'run',
      hyroxDistance: '1000',
      hyroxUnit: 'm',
      hyroxTargetTime: '',
      hyroxWeightClass: 'open_male',
    }
  }
  
  if (programType === 'hybrid') {
    return {
      id: generateId(),
      setNumber,
      reps: '8-12',
      intensityType: 'rir',
      intensityValue: '2',
      restSeconds: 90,
      restBracket: '90-120',
      weightType,
      notes: '',
      hybridMode: 'strength', // default to strength, can toggle
    }
  }
  
  return {
    id: generateId(),
    setNumber,
    reps: '8-12',
    intensityType: 'rir',
    intensityValue: '2',
    restSeconds: 90,
    restBracket: '90-120',
    weightType,
    notes: '',
  }
}

// Helper to check if exercise is cardio-based
function isCardioExercise(exerciseId: string): boolean {
  const exercise = exercisesData.exercises.find((e: any) => e.id === exerciseId)
  if (!exercise) return false
  return exercise.category === 'cardio' || (exercise.tags && exercise.tags.includes('cardio'))
}

// Sortable wrapper for workout items - MUST be outside component to prevent remount
function SortableWorkoutItem({ workoutId, children }: { 
  workoutId: string
  children: (props: { listeners: any; isDragging: boolean }) => React.ReactNode 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workoutId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto' as any,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ listeners, isDragging })}
    </div>
  )
}

// Sortable wrapper for exercise items - MUST be outside component to prevent remount
function SortableExerciseItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className={`bg-zinc-800/30 border border-zinc-800 rounded-xl overflow-hidden ${isDragging ? 'shadow-lg ring-2 ring-yellow-400' : ''}`}>
        <div className="relative">
          {/* Drag handle overlay */}
          <div 
            {...listeners}
            className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-zinc-700/50 transition-colors z-10"
          >
            <GripVertical className="w-4 h-4 text-zinc-500" />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function WorkoutBuilder({ workouts, onChange, programType }: WorkoutBuilderProps) {
  const [showExerciseSelector, setShowExerciseSelector] = useState<string | null>(null)
  const [showFinisherExerciseSelector, setShowFinisherExerciseSelector] = useState<string | null>(null)
  const [showWarmupSelector, setShowWarmupSelector] = useState<string | null>(null)
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set())
  const [expandedFinishers, setExpandedFinishers] = useState<Set<string>>(new Set())
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set())
  // State for replacing an exercise: { workoutId, exerciseId }
  const [replaceExercise, setReplaceExercise] = useState<{ workoutId: string; exerciseId: string } | null>(null)
  // State for template modal: { mode: 'save' | 'load', workoutId: string }
  const [templateModal, setTemplateModal] = useState<{ mode: 'save' | 'load'; workoutId: string } | null>(null)
  // Week selection state
  const [selectedWeek, setSelectedWeek] = useState(1)

  // Get all unique weeks from workouts
  const allWeeks = useMemo(() => {
    const weeks = workouts.map(w => w.weekNumber || 1)
    const uniqueWeeks = [...new Set(weeks)].sort((a, b) => a - b)
    return uniqueWeeks.length > 0 ? uniqueWeeks : [1]
  }, [workouts])

  // Get workouts for the selected week
  const workoutsForSelectedWeek = useMemo(() => {
    return workouts.filter(w => (w.weekNumber || 1) === selectedWeek)
  }, [workouts, selectedWeek])

  // Add a new week
  const addWeek = () => {
    const maxWeek = Math.max(...allWeeks)
    const newWeek = maxWeek + 1
    setSelectedWeek(newWeek)
  }

  // Duplicate a week (copy all workouts to a new week)
  const duplicateWeek = (fromWeek: number) => {
    const maxWeek = Math.max(...allWeeks)
    const toWeek = maxWeek + 1
    const workoutsToDuplicate = workouts.filter(w => (w.weekNumber || 1) === fromWeek)
    
    const duplicatedWorkouts: Workout[] = workoutsToDuplicate.map(w => ({
      ...w,
      id: generateId(),
      weekNumber: toWeek,
      exercises: w.exercises.map(ex => ({
        ...ex,
        id: generateId(),
        sets: ex.sets.map(s => ({ ...s, id: generateId() })),
      })),
      finisher: w.finisher ? {
        ...w.finisher,
        id: generateId(),
        exercises: w.finisher.exercises.map(ex => ({
          ...ex,
          id: generateId(),
          sets: ex.sets.map(s => ({ ...s, id: generateId() })),
        })),
      } : undefined,
    }))
    
    onChange([...workouts, ...duplicatedWorkouts])
    setSelectedWeek(toWeek)
  }

  // Delete a week (remove all workouts for that week)
  const deleteWeek = (week: number) => {
    if (allWeeks.length <= 1) return // Don't delete the last week
    const remainingWorkouts = workouts.filter(w => (w.weekNumber || 1) !== week)
    onChange(remainingWorkouts)
    if (selectedWeek === week) {
      setSelectedWeek(allWeeks.find(w => w !== week) || 1)
    }
  }

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const addWorkout = () => {
    const newWorkout: Workout = {
      id: generateId(),
      name: `Workout ${workoutsForSelectedWeek.length + 1}`,
      dayOfWeek: null,
      order: workoutsForSelectedWeek.length,
      exercises: [],
      notes: '',
      weekNumber: selectedWeek,
    }
    onChange([...workouts, newWorkout])
    setExpandedWorkouts(prev => new Set([...prev, newWorkout.id]))
  }

  const duplicateWorkout = (workout: Workout) => {
    const newWorkout: Workout = {
      ...workout,
      id: generateId(),
      name: `${workout.name} (Copy)`,
      order: workoutsForSelectedWeek.length,
      weekNumber: selectedWeek,
      exercises: workout.exercises.map(ex => ({
        ...ex,
        id: generateId(),
        sets: ex.sets.map(s => ({ ...s, id: generateId() })),
      })),
      finisher: workout.finisher ? {
        ...workout.finisher,
        id: generateId(),
        exercises: workout.finisher.exercises.map(ex => ({
          ...ex,
          id: generateId(),
          sets: ex.sets.map(s => ({ ...s, id: generateId() })),
        })),
      } : undefined,
    }
    onChange([...workouts, newWorkout])
    setExpandedWorkouts(prev => new Set([...prev, newWorkout.id]))
  }

  // Load a template into a workout
  const loadTemplateIntoWorkout = (workoutId: string, templateData: any) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout || !templateData) return

    // Generate new IDs for exercises and sets from the template
    const newExercises: WorkoutExercise[] = (templateData.exercises || []).map((ex: any, idx: number) => ({
      ...ex,
      id: generateId(),
      order: idx,
      sets: (ex.sets || []).map((s: any, sIdx: number) => ({
        ...s,
        id: generateId(),
        setNumber: sIdx + 1,
      })),
    }))

    updateWorkout(workoutId, {
      exercises: [...workout.exercises, ...newExercises],
      notes: workout.notes 
        ? `${workout.notes}\n\n---\nLoaded from template: ${templateData.name || 'Unknown'}`
        : templateData.notes || '',
    })
    setTemplateModal(null)
  }

  // Get workout data for saving as template
  const getWorkoutDataForTemplate = (workoutId: string) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return null
    
    return {
      name: workout.name,
      dayOfWeek: workout.dayOfWeek,
      exercises: workout.exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        category: ex.category,
        order: ex.order,
        notes: ex.notes,
        supersetGroup: ex.supersetGroup,
        sets: ex.sets.map(s => ({
          setNumber: s.setNumber,
          reps: s.reps,
          intensityType: s.intensityType,
          intensityValue: s.intensityValue,
          restSeconds: s.restSeconds,
          restBracket: s.restBracket,
          weightType: s.weightType,
          notes: s.notes,
          cardioType: s.cardioType,
          cardioValue: s.cardioValue,
          cardioUnit: s.cardioUnit,
          heartRateZone: s.heartRateZone,
          workTime: s.workTime,
          restTime: s.restTime,
          hyroxStation: s.hyroxStation,
          hyroxDistance: s.hyroxDistance,
          hyroxUnit: s.hyroxUnit,
          hyroxTargetTime: s.hyroxTargetTime,
          hyroxWeightClass: s.hyroxWeightClass,
          hybridMode: s.hybridMode,
        })),
      })),
      notes: workout.notes,
      isEmom: workout.isEmom,
      emomInterval: workout.emomInterval,
      finisher: workout.finisher ? {
        name: workout.finisher.name,
        category: workout.finisher.category,
        exercises: workout.finisher.exercises.map(ex => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          category: ex.category,
          order: ex.order,
          notes: ex.notes,
          sets: ex.sets.map(s => ({
            setNumber: s.setNumber,
            reps: s.reps,
            intensityType: s.intensityType,
            intensityValue: s.intensityValue,
            restBracket: s.restBracket,
            weightType: s.weightType,
          })),
        })),
        notes: workout.finisher.notes,
        isEmom: workout.finisher.isEmom,
        emomInterval: workout.finisher.emomInterval,
        isSuperset: workout.finisher.isSuperset,
      } : undefined,
    }
  }

  const updateWorkout = (workoutId: string, updates: Partial<Workout>) => {
    onChange(workouts.map(w => w.id === workoutId ? { ...w, ...updates } : w))
  }

  const deleteWorkout = (workoutId: string) => {
    onChange(workouts.filter(w => w.id !== workoutId))
  }

  const addExercise = (workoutId: string, exercise: { id: string; name: string; category: string }) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    const defaultWeightType = getDefaultWeightType(exercise.id)
    const pType = programType || 'strength'
    
    // For hyrox, only 1 set per station by default
    const setCount = pType === 'hyrox' ? 1 : 3

    const newExercise: WorkoutExercise = {
      id: generateId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      order: workout.exercises.length,
      sets: Array.from({ length: setCount }, (_, i) => createDefaultSet(i + 1, defaultWeightType, pType)),
      notes: '',
    }

    updateWorkout(workoutId, {
      exercises: [...workout.exercises, newExercise],
    })
    setShowExerciseSelector(null)
  }

  // Add Hyrox station directly (no exercise selector needed)
  const addHyroxStation = (workoutId: string, station: typeof hyroxStations[0]) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    const newExercise: WorkoutExercise = {
      id: generateId(),
      exerciseId: `hyrox_${station.value}`,
      exerciseName: station.label,
      category: 'hyrox',
      order: workout.exercises.length,
      sets: [{
        id: generateId(),
        setNumber: 1,
        reps: '1',
        intensityType: 'rpe',
        intensityValue: '',
        restSeconds: 0,
        restBracket: '30-60',
        weightType: 'bodyweight',
        notes: '',
        hyroxStation: station.value,
        hyroxDistance: station.defaultDistance,
        hyroxUnit: station.defaultUnit,
        hyroxTargetTime: '',
        hyroxWeightClass: 'open_male',
      }],
      notes: '',
    }

    updateWorkout(workoutId, {
      exercises: [...workout.exercises, newExercise],
    })
  }

  const addSuperset = (workoutId: string, exercises: { id: string; name: string; category: string }[]) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout || exercises.length < 2) return

    const supersetGroupId = `superset_${generateId()}`
    const pType = programType || 'strength'
    const setCount = pType === 'hyrox' ? 1 : 3
    
    const newExercises: WorkoutExercise[] = exercises.map((exercise, index) => {
      const defaultWeightType = getDefaultWeightType(exercise.id)
      return {
        id: generateId(),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        category: exercise.category,
        order: workout.exercises.length + index,
        sets: Array.from({ length: setCount }, (_, i) => createDefaultSet(i + 1, defaultWeightType, pType)),
        notes: '',
        supersetGroup: supersetGroupId,
      }
    })

    updateWorkout(workoutId, {
      exercises: [...workout.exercises, ...newExercises],
    })
    setShowExerciseSelector(null)
  }

  const updateExercise = (workoutId: string, exerciseId: string, updates: Partial<WorkoutExercise>) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    updateWorkout(workoutId, {
      exercises: workout.exercises.map(ex => 
        ex.id === exerciseId ? { ...ex, ...updates } : ex
      ),
    })
  }

  const deleteExercise = (workoutId: string, exerciseId: string) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    updateWorkout(workoutId, {
      exercises: workout.exercises.filter(ex => ex.id !== exerciseId),
    })
  }

  const replaceExerciseWith = (workoutId: string, oldExerciseId: string, newExercise: { id: string; name: string; category: string }) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    const oldExercise = workout.exercises.find(ex => ex.id === oldExerciseId)
    if (!oldExercise) return

    // Keep the same sets, order, and notes - just swap the exercise details
    const updatedExercise: WorkoutExercise = {
      ...oldExercise,
      exerciseId: newExercise.id,
      exerciseName: newExercise.name,
      category: newExercise.category,
    }

    updateWorkout(workoutId, {
      exercises: workout.exercises.map(ex => 
        ex.id === oldExerciseId ? updatedExercise : ex
      ),
    })
    setReplaceExercise(null)
  }

  const reorderExercises = (workoutId: string, activeId: string, overId: string) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    const oldIndex = workout.exercises.findIndex(ex => ex.id === activeId)
    const newIndex = workout.exercises.findIndex(ex => ex.id === overId)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newExercises = arrayMove(workout.exercises, oldIndex, newIndex)
      // Update order property for each exercise
      const updatedExercises = newExercises.map((ex, index) => ({ ...ex, order: index }))
      updateWorkout(workoutId, { exercises: updatedExercises })
    }
  }

  const deleteSuperset = (workoutId: string, supersetGroup: string) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    updateWorkout(workoutId, {
      exercises: workout.exercises.filter(ex => ex.supersetGroup !== supersetGroup),
    })
  }

  const updateAllSets = (workoutId: string, exerciseId: string, updates: Partial<ExerciseSet>) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise) return

    updateExercise(workoutId, exerciseId, {
      sets: exercise.sets.map(s => ({ ...s, ...updates })),
    })
  }

  const setSetCount = (workoutId: string, exerciseId: string, count: number) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise || count < 1 || count > 10) return

    const currentCount = exercise.sets.length
    const weightType = exercise.sets[0]?.weightType || 'freeweight'
    
    if (count > currentCount) {
      const lastSet = exercise.sets[exercise.sets.length - 1]
      const newSets = [...exercise.sets]
      for (let i = currentCount; i < count; i++) {
        newSets.push({
          ...createDefaultSet(i + 1, weightType),
          reps: lastSet?.reps || '8-12',
          intensityType: lastSet?.intensityType || 'rir',
          intensityValue: lastSet?.intensityValue || '2',
          restBracket: lastSet?.restBracket || '90-120',
          weightType: lastSet?.weightType || weightType,
        })
      }
      updateExercise(workoutId, exerciseId, { sets: newSets })
    } else {
      updateExercise(workoutId, exerciseId, {
        sets: exercise.sets.slice(0, count).map((s, i) => ({ ...s, setNumber: i + 1 })),
      })
    }
  }

  const updateSet = (workoutId: string, exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise) return

    updateExercise(workoutId, exerciseId, {
      sets: exercise.sets.map(s => s.id === setId ? { ...s, ...updates } : s),
    })
  }

  const toggleWorkoutExpanded = (workoutId: string) => {
    setExpandedWorkouts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(workoutId)) {
        newSet.delete(workoutId)
      } else {
        newSet.add(workoutId)
      }
      return newSet
    })
  }

  const toggleExerciseExpanded = (exerciseId: string) => {
    setExpandedExercises(prev => {
      const newSet = new Set(prev)
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId)
      } else {
        newSet.add(exerciseId)
      }
      return newSet
    })
  }

  const toggleFinisherExpanded = (workoutId: string) => {
    setExpandedFinishers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(workoutId)) {
        newSet.delete(workoutId)
      } else {
        newSet.add(workoutId)
      }
      return newSet
    })
  }

  // Finisher management functions
  const addFinisher = (workoutId: string, category: 'strength' | 'cardio' | 'hyrox' | 'hybrid') => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    const finisher: WorkoutFinisher = {
      id: generateId(),
      name: `${category.charAt(0).toUpperCase() + category.slice(1)} Finisher`,
      category,
      exercises: [],
      notes: '',
    }

    updateWorkout(workoutId, { finisher })
    setExpandedFinishers(prev => new Set([...prev, workoutId]))
  }

  const updateFinisher = (workoutId: string, updates: Partial<WorkoutFinisher>) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout?.finisher) return

    updateWorkout(workoutId, {
      finisher: { ...workout.finisher, ...updates }
    })
  }

  const removeFinisher = (workoutId: string) => {
    updateWorkout(workoutId, { finisher: undefined })
  }

  const addExerciseToFinisher = (workoutId: string, exercise: { id: string; name: string; category: string }) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout?.finisher) return

    const defaultWeightType = getDefaultWeightType(exercise.id)
    const finisherCategory = workout.finisher.category

    const newExercise: WorkoutExercise = {
      id: generateId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      order: workout.finisher.exercises.length,
      sets: Array.from({ length: finisherCategory === 'hyrox' ? 1 : 3 }, (_, i) => 
        createDefaultSet(i + 1, defaultWeightType, finisherCategory)
      ),
      notes: '',
    }

    updateFinisher(workoutId, {
      exercises: [...workout.finisher.exercises, newExercise]
    })
    setShowFinisherExerciseSelector(null)
  }

  // Add superset to finisher
  const addSupersetToFinisher = (workoutId: string, exercises: { id: string; name: string; category: string }[]) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout?.finisher || exercises.length < 2) return

    const supersetGroupId = `superset_${generateId()}`
    const finisherCategory = workout.finisher.category
    const setCount = finisherCategory === 'hyrox' ? 1 : 3

    const newExercises: WorkoutExercise[] = exercises.map((exercise, index) => {
      const defaultWeightType = getDefaultWeightType(exercise.id)
      return {
        id: generateId(),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        category: exercise.category,
        order: workout.finisher!.exercises.length + index,
        sets: Array.from({ length: setCount }, (_, i) => 
          createDefaultSet(i + 1, defaultWeightType, finisherCategory)
        ),
        notes: '',
        supersetGroup: supersetGroupId,
      }
    })

    updateFinisher(workoutId, {
      exercises: [...workout.finisher.exercises, ...newExercises]
    })
    setShowFinisherExerciseSelector(null)
  }

  // Add exercise to warmup section
  const addWarmupExercise = (workoutId: string, exercise: { id: string; name: string; category: string }) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout) return

    const defaultWeightType = getDefaultWeightType(exercise.id)
    const warmupExercises = workout.warmupExercises || []

    const newExercise: WorkoutExercise = {
      id: generateId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      category: exercise.category,
      order: warmupExercises.length,
      sets: [{
        id: generateId(),
        setNumber: 1,
        reps: '10',
        intensityType: 'rir',
        intensityValue: '3',
        restSeconds: 60,
        restBracket: '30-60',
        weightType: defaultWeightType,
        notes: '',
      }],
      notes: '',
    }

    updateWorkout(workoutId, {
      warmupExercises: [...warmupExercises, newExercise]
    })
    setShowWarmupSelector(null)
  }

  // Add Hyrox station to finisher directly
  const addHyroxStationToFinisher = (workoutId: string, station: typeof hyroxStations[0]) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout?.finisher) return

    const newExercise: WorkoutExercise = {
      id: generateId(),
      exerciseId: `hyrox_${station.value}`,
      exerciseName: station.label,
      category: 'hyrox',
      order: workout.finisher.exercises.length,
      sets: [{
        id: generateId(),
        setNumber: 1,
        reps: '1',
        intensityType: 'rpe',
        intensityValue: '',
        restSeconds: 0,
        restBracket: '30-60',
        weightType: 'bodyweight',
        notes: '',
        hyroxStation: station.value,
        hyroxDistance: station.defaultDistance,
        hyroxUnit: station.defaultUnit,
        hyroxTargetTime: '',
        hyroxWeightClass: 'open_male',
      }],
      notes: '',
    }

    updateFinisher(workoutId, {
      exercises: [...workout.finisher.exercises, newExercise]
    })
  }

  const deleteExerciseFromFinisher = (workoutId: string, exerciseId: string) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout?.finisher) return

    updateFinisher(workoutId, {
      exercises: workout.finisher.exercises.filter(ex => ex.id !== exerciseId)
    })
  }

  const updateFinisherExercise = (workoutId: string, exerciseId: string, updates: Partial<WorkoutExercise>) => {
    const workout = workouts.find(w => w.id === workoutId)
    if (!workout?.finisher) return

    updateFinisher(workoutId, {
      exercises: workout.finisher.exercises.map(ex =>
        ex.id === exerciseId ? { ...ex, ...updates } : ex
      )
    })
  }

  const updateAllFinisherSets = (workoutId: string, exerciseId: string, updates: Partial<ExerciseSet>) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.finisher?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise) return

    updateFinisherExercise(workoutId, exerciseId, {
      sets: exercise.sets.map(s => ({ ...s, ...updates }))
    })
  }

  // Group exercises by superset
  const groupExercises = (exercises: WorkoutExercise[]) => {
    const groups: { type: 'single' | 'superset'; exercises: WorkoutExercise[]; supersetGroup?: string }[] = []
    const processedSupersets = new Set<string>()

    exercises.forEach(exercise => {
      if (exercise.supersetGroup) {
        if (!processedSupersets.has(exercise.supersetGroup)) {
          processedSupersets.add(exercise.supersetGroup)
          const supersetExercises = exercises.filter(ex => ex.supersetGroup === exercise.supersetGroup)
          groups.push({ type: 'superset', exercises: supersetExercises, supersetGroup: exercise.supersetGroup })
        }
      } else {
        groups.push({ type: 'single', exercises: [exercise] })
      }
    })

    return groups
  }

  // Set count for finisher exercises
  const setFinisherSetCount = (workoutId: string, exerciseId: string, count: number) => {
    const workout = workouts.find(w => w.id === workoutId)
    const exercise = workout?.finisher?.exercises.find(ex => ex.id === exerciseId)
    if (!exercise || !workout?.finisher || count < 1 || count > 10) return

    const currentCount = exercise.sets.length
    const weightType = exercise.sets[0]?.weightType || 'freeweight'
    const finisherType = workout.finisher.category
    
    if (count > currentCount) {
      const lastSet = exercise.sets[exercise.sets.length - 1]
      const newSets = [...exercise.sets]
      for (let i = currentCount; i < count; i++) {
        newSets.push({
          ...createDefaultSet(i + 1, weightType, finisherType),
          reps: lastSet?.reps || '8-12',
          intensityType: lastSet?.intensityType || 'rir',
          intensityValue: lastSet?.intensityValue || '2',
          restBracket: lastSet?.restBracket || '90-120',
          weightType: lastSet?.weightType || weightType,
        })
      }
      updateFinisherExercise(workoutId, exerciseId, { sets: newSets })
    } else {
      updateFinisherExercise(workoutId, exerciseId, {
        sets: exercise.sets.slice(0, count).map((s, i) => ({ ...s, setNumber: i + 1 })),
      })
    }
  }

  const renderFinisherExerciseCard = (workout: Workout, exercise: WorkoutExercise, exerciseIndex: number) => {
    if (!exercise || !exercise.sets) return null
    const finisherType = workout.finisher?.category || 'strength'
    const firstSet = exercise.sets[0]
    const isCardio = finisherType === 'cardio'
    const isHyrox = finisherType === 'hyrox'
    const isHybrid = finisherType === 'hybrid'
    const hybridMode = firstSet?.hybridMode || 'strength'
    const showStrengthFields = !isCardio && !isHyrox && (!isHybrid || hybridMode === 'strength')
    const showCardioFields = isCardio || (isHybrid && hybridMode === 'cardio')

    return (
      <div className="p-3">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-sm font-mono w-6">{exerciseIndex + 1}</span>
          <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center">
            <Dumbbell className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white text-sm truncate">{exercise.exerciseName}</h4>
            <span className="text-xs text-zinc-500 capitalize">{exercise.category}</span>
          </div>
          <button
            type="button"
            onClick={() => deleteExerciseFromFinisher(workout.id, exercise.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Finisher Exercise Controls */}
        <div className="mt-3 flex flex-wrap items-center gap-3 pl-10">
          {/* Hybrid Mode Toggle */}
          {isHybrid && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Mode</span>
                <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                  {[{ value: 'strength', label: 'Strength', icon: 'S' }, { value: 'cardio', label: 'Cardio', icon: 'C' }].map(mode => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => updateAllFinisherSets(workout.id, exercise.id, { hybridMode: mode.value as 'strength' | 'cardio' })}
                      className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                        hybridMode === mode.value
                          ? 'bg-yellow-400 text-black'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span>{mode.icon}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-px h-5 bg-zinc-700" />
            </>
          )}

          {/* Sets control - always show for all finisher types */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">Sets</span>
            <button type="button"
              onClick={() => setFinisherSetCount(workout.id, exercise.id, exercise.sets.length - 1)}
              className="w-5 h-5 rounded bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              disabled={exercise.sets.length <= 1}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-5 text-center text-white text-sm font-medium">{exercise.sets.length}</span>
            <button type="button"
              onClick={() => setFinisherSetCount(workout.id, exercise.id, exercise.sets.length + 1)}
              className="w-5 h-5 rounded bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              disabled={exercise.sets.length >= 10}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="w-px h-5 bg-zinc-700" />

          {isHyrox ? (
            /* Hyrox Fields - Station already selected via picker */
            <>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={firstSet?.hyroxDistance || '1000'}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { hyroxDistance: e.target.value })}
                  className="w-14 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                />
                <select
                  value={firstSet?.hyroxUnit || 'm'}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { hyroxUnit: e.target.value })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="m">m</option>
                  <option value="km">km</option>
                  <option value="reps">reps</option>
                  <option value="cal">cal</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Target</span>
                <input
                  type="text"
                  value={firstSet?.hyroxTargetTime || ''}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { hyroxTargetTime: e.target.value })}
                  className="w-14 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="4:30"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Class</span>
                <select
                  value={firstSet?.hyroxWeightClass || 'open_male'}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { hyroxWeightClass: e.target.value })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="pro_male">Pro M</option>
                  <option value="pro_female">Pro F</option>
                  <option value="open_male">Open M</option>
                  <option value="open_female">Open F</option>
                  <option value="doubles_male">Dbl M</option>
                  <option value="doubles_female">Dbl F</option>
                </select>
              </div>
            </>
          ) : showCardioFields ? (
            /* Cardio Fields */
            <>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Type</span>
                <select
                  value={firstSet?.cardioType || 'duration'}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { cardioType: e.target.value as ExerciseSet['cardioType'] })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  {cardioTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={firstSet?.cardioValue || '20'}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { cardioValue: e.target.value })}
                  className="w-14 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                />
                <select
                  value={firstSet?.cardioUnit || 'min'}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { cardioUnit: e.target.value })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="min">min</option>
                  <option value="sec">sec</option>
                  <option value="m">m</option>
                  <option value="km">km</option>
                  <option value="cal">cal</option>
                  <option value="rounds">rounds</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">HR Zone</span>
                <select
                  value={firstSet?.heartRateZone || ''}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { heartRateZone: e.target.value ? parseInt(e.target.value) as 1|2|3|4|5 : undefined })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="">-</option>
                  {heartRateZones.map(zone => (
                    <option key={zone.value} value={zone.value}>Z{zone.value}</option>
                  ))}
                </select>
              </div>
            </>
          ) : showStrengthFields ? (
            /* Strength Fields - Sets already shown above */
            <>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Reps</span>
                <input
                  type="text"
                  value={firstSet?.reps || '8-12'}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { reps: e.target.value })}
                  className="w-14 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                />
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={firstSet?.intensityType || 'rir'}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { intensityType: e.target.value as ExerciseSet['intensityType'] })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  {intensityTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
                {firstSet?.intensityType !== 'failure' && (
                  <input
                    type="text"
                    value={firstSet?.intensityValue || '2'}
                    onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { intensityValue: e.target.value })}
                    className="w-10 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  />
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Rest</span>
                <select
                  value={firstSet?.restBracket || '90-120'}
                  onChange={(e) => updateAllFinisherSets(workout.id, exercise.id, { restBracket: e.target.value })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  {restBrackets.map(bracket => (
                    <option key={bracket.value} value={bracket.value}>{bracket.label}</option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  const renderExerciseCard = (workout: Workout, exercise: WorkoutExercise, exerciseIndex: number, isSuperset: boolean = false) => {
    if (!exercise || !exercise.sets) return null
    const isExpanded = expandedExercises.has(exercise.id)
    const firstSet = exercise.sets[0]
    const isCardio = exercise.category === 'cardio' || isCardioExercise(exercise.exerciseId) || programType === 'cardio'
    const isHyrox = programType === 'hyrox'
    const isHybrid = programType === 'hybrid'
    // For hybrid, check the mode of the first set (or default to strength)
    const hybridMode = firstSet?.hybridMode || 'strength'
    const showStrengthFields = !isCardio && !isHyrox && (!isHybrid || hybridMode === 'strength')
    const showCardioFields = isCardio || (isHybrid && hybridMode === 'cardio')

    return (
      <div key={exercise.id} className={`p-3 ${!isSuperset ? 'pl-12' : ''}`}>
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-sm font-mono w-6">{exerciseIndex + 1}</span>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSuperset ? 'bg-yellow-400/20' : 'bg-zinc-700'}`}>
            <Dumbbell className={`w-5 h-5 ${isSuperset ? 'text-yellow-400' : 'text-zinc-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white truncate">{exercise.exerciseName}</h4>
            <span className="text-xs text-zinc-500 capitalize">{exercise.category}</span>
          </div>
          {!isSuperset && (
            <div className="flex items-center gap-1">
              <button type="button"
                onClick={() => setReplaceExercise({ workoutId: workout.id, exerciseId: exercise.id })}
                className="p-1.5 rounded-lg hover:bg-yellow-500/20 text-zinc-500 hover:text-yellow-400 transition-colors"
                title="Replace exercise"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button type="button"
                onClick={() => deleteExercise(workout.id, exercise.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                title="Delete exercise"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Quick Edit Row */}
        <div className={`mt-3 flex flex-wrap items-center gap-3 ${isSuperset ? 'pl-10' : 'pl-[72px]'}`}>
          {/* Hybrid Mode Toggle */}
          {isHybrid && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Mode</span>
                <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                  {hybridModes.map(mode => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => updateAllSets(workout.id, exercise.id, { hybridMode: mode.value as any })}
                      className={`px-3 py-1 text-sm flex items-center gap-1 transition-colors ${
                        hybridMode === mode.value
                          ? 'bg-yellow-400 text-black'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span>{mode.icon}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-px h-6 bg-zinc-700" />
            </>
          )}

          {isHyrox ? (
            /* === HYROX FIELDS === */
            <>
              {/* Distance/Reps */}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={firstSet?.hyroxDistance || '1000'}
                  onChange={(e) => updateAllSets(workout.id, exercise.id, { hyroxDistance: e.target.value })}
                  className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="1000"
                />
                <select
                  value={firstSet?.hyroxUnit || 'm'}
                  onChange={(e) => updateAllSets(workout.id, exercise.id, { hyroxUnit: e.target.value })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="m">meters</option>
                  <option value="km">km</option>
                  <option value="reps">reps</option>
                  <option value="cal">calories</option>
                </select>
              </div>

              <div className="w-px h-6 bg-zinc-700" />

              {/* Target Time */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Target</span>
                <input
                  type="text"
                  value={firstSet?.hyroxTargetTime || ''}
                  onChange={(e) => updateAllSets(workout.id, exercise.id, { hyroxTargetTime: e.target.value })}
                  className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="4:30"
                />
              </div>

              <div className="w-px h-6 bg-zinc-700" />

              {/* Weight Class */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Class</span>
                <select
                  value={firstSet?.hyroxWeightClass || 'open_male'}
                  onChange={(e) => updateAllSets(workout.id, exercise.id, { hyroxWeightClass: e.target.value })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  {hyroxWeightClasses.map(wc => (
                    <option key={wc.value} value={wc.value}>{wc.label}</option>
                  ))}
                </select>
              </div>

              {/* Custom Weight (if custom class selected) */}
              {firstSet?.hyroxWeightClass === 'custom' && (
                <>
                  <div className="w-px h-6 bg-zinc-700" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-500">Weight</span>
                    <input
                      type="text"
                      value={firstSet?.hyroxCustomWeight || ''}
                      onChange={(e) => updateAllSets(workout.id, exercise.id, { hyroxCustomWeight: e.target.value })}
                      className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      placeholder="e.g. 30kg"
                    />
                  </div>
                </>
              )}
            </>
          ) : showCardioFields ? (
            /* === CARDIO FIELDS === */
            <>
              {/* Cardio Type */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Type</span>
                <select
                  value={firstSet?.cardioType || 'duration'}
                  onChange={(e) => updateAllSets(workout.id, exercise.id, { cardioType: e.target.value as any })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  {cardioTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                  ))}
                </select>
              </div>

              <div className="w-px h-6 bg-zinc-700" />

              {/* Value & Unit - simplified for steps */}
              {firstSet?.cardioType === 'steps' ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={firstSet?.cardioValue || '10000'}
                    onChange={(e) => updateAllSets(workout.id, exercise.id, { cardioValue: e.target.value, cardioUnit: 'steps' })}
                    className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                    placeholder="10000"
                  />
                  <span className="text-xs text-zinc-500">steps</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={firstSet?.cardioValue || '20'}
                    onChange={(e) => updateAllSets(workout.id, exercise.id, { cardioValue: e.target.value })}
                    className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                    placeholder="20"
                  />
                  <select
                    value={firstSet?.cardioUnit || 'min'}
                    onChange={(e) => updateAllSets(workout.id, exercise.id, { cardioUnit: e.target.value })}
                    className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  >
                    <option value="min">min</option>
                    <option value="sec">sec</option>
                    <option value="m">meters</option>
                    <option value="km">km</option>
                    <option value="mi">miles</option>
                    <option value="cal">calories</option>
                    <option value="rounds">rounds</option>
                  </select>
                </div>
              )}

              <div className="w-px h-6 bg-zinc-700" />

              {/* Heart Rate Zone */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">HR Zone</span>
                <select
                  value={firstSet?.heartRateZone || 2}
                  onChange={(e) => updateAllSets(workout.id, exercise.id, { heartRateZone: parseInt(e.target.value) as any })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="">Optional</option>
                  {heartRateZones.map(zone => (
                    <option key={zone.value} value={zone.value}>{zone.label} - {zone.desc}</option>
                  ))}
                </select>
              </div>

              {/* EMOM/Intervals fields */}
              {firstSet?.cardioType === 'intervals' && (
                <>
                  <div className="w-px h-6 bg-zinc-700" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-500">Work</span>
                    <input
                      type="text"
                      value={firstSet?.workTime || '40s'}
                      onChange={(e) => updateAllSets(workout.id, exercise.id, { workTime: e.target.value })}
                      className="w-14 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      placeholder="40s"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-500">Rest</span>
                    <input
                      type="text"
                      value={firstSet?.restTime || '20s'}
                      onChange={(e) => updateAllSets(workout.id, exercise.id, { restTime: e.target.value })}
                      className="w-14 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      placeholder="20s"
                    />
                  </div>
                </>
              )}
            </>
          ) : showStrengthFields ? (
            /* === STRENGTH FIELDS === */
            <>
              {/* Set Count */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500 mr-1">Sets</span>
                <button type="button"
                  onClick={() => setSetCount(workout.id, exercise.id, exercise.sets.length - 1)}
                  className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                  disabled={exercise.sets.length <= 1}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-white font-medium">{exercise.sets.length}</span>
                <button type="button"
                  onClick={() => setSetCount(workout.id, exercise.id, exercise.sets.length + 1)}
                  className="w-6 h-6 rounded bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                  disabled={exercise.sets.length >= 10}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="w-px h-6 bg-zinc-700" />

              {/* Reps */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Reps</span>
                <input
                  type="text"
                  value={firstSet?.reps || '8-12'}
                  onChange={(e) => updateAllSets(workout.id, exercise.id, { reps: e.target.value })}
                  className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  placeholder="8-12"
                />
              </div>

              {/* Intensity */}
              <div className="flex items-center gap-1">
                <select
                  value={firstSet?.intensityType || 'rir'}
                  onChange={(e) => updateAllSets(workout.id, exercise.id, { 
                    intensityType: e.target.value as ExerciseSet['intensityType'],
                    // Set sensible defaults when switching types
                    intensityValue: e.target.value === 'time' ? '30' : 
                                   e.target.value === 'percentage' ? '70' : '2'
                  })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="rir">RIR</option>
                  <option value="rpe">RPE</option>
                  <option value="percentage">% 1RM</option>
                  <option value="time">Time</option>
                  <option value="failure">Failure</option>
                </select>
                {firstSet?.intensityType !== 'failure' && (
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={firstSet?.intensityValue || (firstSet?.intensityType === 'time' ? '30' : '2')}
                      onChange={(e) => updateAllSets(workout.id, exercise.id, { intensityValue: e.target.value })}
                      placeholder={firstSet?.intensityType === 'time' ? '30' : '2'}
                      className={`${firstSet?.intensityType === 'time' ? 'w-14' : 'w-12'} px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400`}
                    />
                    {firstSet?.intensityType === 'time' && (
                      <span className="text-xs text-zinc-500 ml-1">sec</span>
                    )}
                  </div>
                )}
              </div>

              {/* Rest */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500">Rest</span>
                <select
                  value={firstSet?.restBracket || '90-120'}
                  onChange={(e) => updateAllSets(workout.id, exercise.id, { 
                    restBracket: e.target.value,
                    restSeconds: parseInt(e.target.value.split('-')[0]) || 90
                  })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  {restBrackets.map(bracket => (
                    <option key={bracket.value} value={bracket.value}>{bracket.label}</option>
                  ))}
                </select>
              </div>

              {/* Weight Type */}
              <div className="flex items-center gap-1">
                <select
                  value={firstSet?.weightType || 'freeweight'}
                  onChange={(e) => updateAllSets(workout.id, exercise.id, { weightType: e.target.value })}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  <option value="bodyweight">BW</option>
                  <option value="freeweight">DB/BB</option>
                  <option value="machine">Machine</option>
                  <option value="cable">Cable</option>
                  <option value="kettlebell">KB</option>
                  <option value="smith_machine">Smith</option>
                  <option value="plate_loaded">Plate</option>
                  <option value="resistance_band">Band</option>
                </select>
              </div>
            </>
          ) : null}

          <div className="flex-1" />

          {/* Expand for individual editing - hide for cardio duration/distance/calories/steps (no sets needed) */}
          {!(showCardioFields && firstSet?.cardioType !== 'intervals') && (
            <button type="button"
              onClick={() => toggleExerciseExpanded(exercise.id)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-yellow-400 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{isExpanded ? 'Hide' : 'Edit'} sets</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Individual Sets Table - hide for cardio duration/distance/calories/steps */}
        {isExpanded && !(showCardioFields && firstSet?.cardioType !== 'intervals') && (
          <div className={`mt-3 border-t border-zinc-800 ${isSuperset ? 'ml-10' : ''}`}>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase">
                  <th className="px-3 py-2 text-left w-16">Set</th>
                  <th className="px-3 py-2 text-left">Reps</th>
                  <th className="px-3 py-2 text-left">Weight Type</th>
                  <th className="px-3 py-2 text-left">Intensity</th>
                  <th className="px-3 py-2 text-left">Rest</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((set) => (
                  <tr key={set.id} className="border-t border-zinc-800/50">
                    <td className="px-3 py-2">
                      <span className="text-zinc-400 font-mono">{set.setNumber}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={set.reps}
                        onChange={(e) => updateSet(workout.id, exercise.id, set.id, { reps: e.target.value })}
                        className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={set.weightType || 'freeweight'}
                        onChange={(e) => updateSet(workout.id, exercise.id, set.id, { weightType: e.target.value })}
                        className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      >
                        {weightTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <select
                          value={set.intensityType}
                          onChange={(e) => updateSet(workout.id, exercise.id, set.id, { 
                            intensityType: e.target.value as ExerciseSet['intensityType'] 
                          })}
                          className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        >
                          {intensityTypes.map(type => (
                            <option key={type.id} value={type.id}>{type.label}</option>
                          ))}
                        </select>
                        {set.intensityType !== 'failure' && (
                          <input
                            type="text"
                            value={set.intensityValue}
                            onChange={(e) => updateSet(workout.id, exercise.id, set.id, { intensityValue: e.target.value })}
                            className="w-14 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={set.restBracket || '90-120'}
                        onChange={(e) => updateSet(workout.id, exercise.id, set.id, { 
                          restBracket: e.target.value,
                          restSeconds: parseInt(e.target.value.split('-')[0]) || 90
                        })}
                        className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                      >
                        {restBrackets.map(bracket => (
                          <option key={bracket.value} value={bracket.value}>{bracket.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={set.notes}
                        onChange={(e) => updateSet(workout.id, exercise.id, set.id, { notes: e.target.value })}
                        className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        placeholder="Set notes..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // Sortable wrapper for exercise items
  // Handle drag end for reordering
  const handleDragEnd = (workoutId: string) => (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderExercises(workoutId, active.id as string, over.id as string)
    }
  }

  // Day names for grouping
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Group workouts by day (filtered by selected week)
  // Memoize the day grouping structure (only recalculate when workout IDs or days change)
  const dayStructure = useMemo(() => {
    const structure: { day: number | null; dayName: string; workoutIds: string[] }[] = []
    const dayMap = new Map<number | null, string[]>()

    // Filter workouts by selected week
    const weekWorkouts = workouts.filter(w => (w.weekNumber || 1) === selectedWeek)

    weekWorkouts.forEach(w => {
      const existing = dayMap.get(w.dayOfWeek)
      if (existing) {
        existing.push(w.id)
      } else {
        dayMap.set(w.dayOfWeek, [w.id])
      }
    })

    // Sort by day of week (Monday-first: Mon=0, Tue=1, ..., Sun=6, then null/unassigned at bottom)
    // Convert JS day (0=Sun) to Monday-first index for sorting
    const toMondayFirst = (day: number) => (day + 6) % 7
    const sortedDays = Array.from(dayMap.keys()).sort((a, b) => {
      if (a === null) return 1
      if (b === null) return -1
      return toMondayFirst(a) - toMondayFirst(b)
    })

    sortedDays.forEach(day => {
      const ids = dayMap.get(day) || []
      structure.push({
        day,
        dayName: day === null ? 'Unassigned' : dayNames[day],
        workoutIds: ids
      })
    })

    return structure
  }, [workouts.map(w => `${w.id}:${w.dayOfWeek}:${w.order}:${w.weekNumber}`).join(','), selectedWeek])

  // Get actual workout objects for rendering (always fresh)
  const getWorkoutById = (id: string) => workouts.find(w => w.id === id)

  // Reorder workouts via drag and drop (within same day group)
  const reorderWorkouts = (activeId: string, overId: string) => {
    const activeWorkout = workouts.find(w => w.id === activeId)
    const overWorkout = workouts.find(w => w.id === overId)
    
    // Only allow reordering within the same day
    if (!activeWorkout || !overWorkout || activeWorkout.dayOfWeek !== overWorkout.dayOfWeek) return

    const oldIndex = workouts.findIndex(w => w.id === activeId)
    const newIndex = workouts.findIndex(w => w.id === overId)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newWorkouts = arrayMove(workouts, oldIndex, newIndex)
      // Update order property for each workout
      const updatedWorkouts = newWorkouts.map((w, index) => ({ ...w, order: index }))
      onChange(updatedWorkouts)
    }
  }

  const handleWorkoutDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderWorkouts(active.id as string, over.id as string)
    }
  }

  // Sortable wrapper for workout items
  return (
    <div className="space-y-6">
      {/* Week Selector */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Program Weeks</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => duplicateWeek(selectedWeek)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors"
              title="Duplicate current week"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate Week
            </button>
            <button
              type="button"
              onClick={addWeek}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-bold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Week
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {allWeeks.map((week) => (
            <button
              type="button"
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                selectedWeek === week
                  ? 'bg-yellow-400 text-black'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Week {week}
              <span className="ml-1.5 text-xs opacity-70">
                ({workouts.filter(w => (w.weekNumber || 1) === week).length})
              </span>
            </button>
          ))}
        </div>
        
        {allWeeks.length > 1 && (
          <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              Viewing Week {selectedWeek} • {workoutsForSelectedWeek.length} workout{workoutsForSelectedWeek.length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete Week ${selectedWeek} and all its workouts?`)) {
                  deleteWeek(selectedWeek)
                }
              }}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Delete Week {selectedWeek}
            </button>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleWorkoutDragEnd}
      >
        {dayStructure.map((group) => (
          <div key={group.dayName} className="space-y-3">
            {/* Day Header */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                group.day === null ? 'icon-inverted' : 'bg-yellow-400/20'
              }`}>
                <span className={`text-sm font-bold ${
                  group.day === null ? '' : 'text-yellow-400'
                }`}>
                  {group.day === null ? '?' : group.dayName.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{group.dayName}</h3>
                <p className="text-xs text-zinc-500">{group.workoutIds.length} workout{group.workoutIds.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* Workouts for this day */}
            <SortableContext
              items={group.workoutIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3 pl-4 border-l-2 border-zinc-700">
                {group.workoutIds.map((workoutId) => {
                  const workout = getWorkoutById(workoutId)
                  if (!workout) return null
                  return (
                  <SortableWorkoutItem key={workout.id} workoutId={workout.id}>
                    {({ listeners, isDragging }) => (
                      <div className={`card overflow-hidden ${isDragging ? 'shadow-lg ring-2 ring-yellow-400' : ''}`}>
                        {/* Workout Header */}
                        <div 
                          className="flex items-center gap-4 p-4 bg-zinc-800/50 cursor-pointer"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWorkoutExpanded(workout.id) }}
                        >
                          <div 
                            {...listeners}
                            className="text-zinc-600 cursor-grab active:cursor-grabbing hover:text-zinc-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical className="w-5 h-5" />
                          </div>

            <div className="flex-1">
              <input
                type="text"
                value={workout.name}
                onChange={(e) => updateWorkout(workout.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent text-lg font-semibold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded px-2 -ml-2"
                placeholder="Workout Name"
              />
              <div className="flex items-center gap-4 mt-1">
                <select
                  value={workout.dayOfWeek ?? ''}
                  onChange={(e) => updateWorkout(workout.id, { 
                    dayOfWeek: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm bg-transparent text-zinc-400 focus:outline-none"
                >
                  <option value="">No specific day</option>
                  {daysOfWeek.map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
                <span className="text-sm text-zinc-500">
                  {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                </span>
                
                {/* EMOM Toggle - only for cardio/hyrox/hybrid */}
                {(programType === 'cardio' || programType === 'hyrox' || programType === 'hybrid') && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-zinc-600">|</span>
                    <button
                      type="button"
                      onClick={() => updateWorkout(workout.id, { 
                        isEmom: !workout.isEmom,
                        emomInterval: workout.isEmom ? undefined : 60
                      })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        workout.isEmom 
                          ? 'bg-yellow-400 text-black' 
                          : 'badge-inverted hover:opacity-80'
                      }`}
                    >
                      EMOM
                    </button>
                    {workout.isEmom && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-zinc-500">every</span>
                        <select
                          value={workout.emomInterval || 60}
                          onChange={(e) => updateWorkout(workout.id, { emomInterval: parseInt(e.target.value) })}
                          className="px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        >
                          <option value={30}>30s</option>
                          <option value={45}>45s</option>
                          <option value={60}>1 min</option>
                          <option value={90}>90s</option>
                          <option value={120}>2 min</option>
                          <option value={180}>3 min</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button type="button"
                onClick={(e) => { e.stopPropagation(); setTemplateModal({ mode: 'load', workoutId: workout.id }) }}
                className="p-2 rounded-lg hover:bg-blue-500/20 text-zinc-400 hover:text-blue-400 transition-colors"
                title="Load from template"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); setTemplateModal({ mode: 'save', workoutId: workout.id }) }}
                className="p-2 rounded-lg hover:bg-green-500/20 text-zinc-400 hover:text-green-400 transition-colors"
                title="Save as template"
                disabled={workout.exercises.length === 0}
              >
                <Dumbbell className="w-4 h-4" />
              </button>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); duplicateWorkout(workout) }}
                className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                title="Duplicate workout"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button type="button"
                onClick={(e) => { e.stopPropagation(); deleteWorkout(workout.id) }}
                className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                title="Delete workout"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {expandedWorkouts.has(workout.id) ? (
                <ChevronUp className="w-5 h-5 text-zinc-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-zinc-500" />
              )}
            </div>
          </div>

          {/* Workout Content */}
          {expandedWorkouts.has(workout.id) && (
            <div className="p-4 space-y-4">
              {/* Warmup Section (optional) */}
              <div className="border border-green-500/20 bg-green-500/5 rounded-xl overflow-hidden">
                <div 
                  className="flex items-center justify-between px-4 py-3 bg-green-500/10 cursor-pointer"
                  onClick={() => {
                    const warmupId = `warmup-${workout.id}`
                    setExpandedWorkouts(prev => {
                      const next = new Set(prev)
                      if (next.has(warmupId)) next.delete(warmupId)
                      else next.add(warmupId)
                      return next
                    })
                  }}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-sm font-medium text-green-400">Warmup</span>
                    <span className="text-xs text-zinc-500">
                      {(workout.warmupExercises?.length || 0)} exercise{(workout.warmupExercises?.length || 0) !== 1 ? 's' : ''}
                    </span>
                    <span className="text-zinc-600 text-[10px]">(optional)</span>
                  </div>
                  {expandedWorkouts.has(`warmup-${workout.id}`) ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  )}
                </div>
                
                {expandedWorkouts.has(`warmup-${workout.id}`) && (
                  <div className="p-3 space-y-2">
                    {(workout.warmupExercises || []).map((exercise, idx) => (
                      <div key={exercise.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                        <span className="w-6 h-6 rounded bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="flex-1 text-white text-sm">{exercise.exerciseName}</span>
                        <span className="text-zinc-500 text-xs">
                          {exercise.sets.length} × {exercise.sets[0]?.reps || '-'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const warmupExercises = [...(workout.warmupExercises || [])]
                            warmupExercises.splice(idx, 1)
                            updateWorkout(workout.id, { warmupExercises })
                          }}
                          className="p-1 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowWarmupSelector(workout.id)}
                      className="w-full py-2 border border-dashed border-green-500/30 hover:border-green-500 rounded-lg text-green-400 text-sm flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Warmup Exercise
                    </button>
                  </div>
                )}
              </div>

              {/* Main Exercises - with drag and drop */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd(workout.id)}
              >
                <SortableContext
                  items={workout.exercises.filter(ex => !ex.supersetGroup).map(ex => ex.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {groupExercises(workout.exercises).map((group, groupIndex) => {
                      if (group.type === 'superset') {
                        return (
                          <div 
                            key={group.supersetGroup} 
                            className="bg-yellow-400/5 border-2 border-yellow-400/30 rounded-xl overflow-hidden"
                          >
                            {/* Superset Header */}
                            <div className="flex items-center justify-between px-4 py-2 bg-yellow-400/10 border-b border-yellow-400/20">
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-yellow-400" />
                                <span className="text-sm font-medium text-yellow-400">
                                  Superset ({group.exercises.length} exercises)
                                </span>
                              </div>
                              <button type="button"
                                onClick={() => deleteSuperset(workout.id, group.supersetGroup!)}
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            {/* Superset Exercises */}
                            <div className="divide-y divide-yellow-400/10">
                              {group.exercises.map((exercise, exIndex) => (
                                <div key={exercise.id}>
                                  {renderExerciseCard(workout, exercise, workout.exercises.indexOf(exercise), true)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      } else {
                        const exercise = group.exercises[0]
                        return (
                          <SortableExerciseItem key={exercise.id} id={exercise.id}>
                            {renderExerciseCard(workout, exercise, workout.exercises.indexOf(exercise), false)}
                          </SortableExerciseItem>
                        )
                      }
                    })}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Add Exercise/Station Button */}
              {programType === 'hyrox' ? (
                /* Hyrox: Show station picker + custom exercise option */
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Add Station</p>
                  <div className="grid grid-cols-3 gap-2">
                    {hyroxStations.map(station => (
                      <button
                        key={station.value}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); addHyroxStation(workout.id, station) }}
                        className="flex flex-col items-center gap-1 p-3 bg-zinc-800/50 border border-zinc-700 hover:border-orange-400/50 hover:bg-orange-500/10 rounded-xl text-zinc-400 hover:text-orange-400 transition-all"
                      >
                        <span className="text-lg font-bold">{station.icon}</span>
                        <span className="text-xs">{station.label}</span>
                      </button>
                    ))}
                  </div>
                  {/* Custom Exercise Option */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowExerciseSelector(workout.id) }}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-zinc-600 hover:border-yellow-400/50 rounded-xl text-zinc-500 hover:text-yellow-400 text-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Custom Exercise</span>
                  </button>
                </div>
              ) : (
                /* Other types: Show exercise selector */
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); setShowExerciseSelector(workout.id) }}
                  className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-zinc-700 hover:border-yellow-400/50 rounded-xl text-zinc-400 hover:text-yellow-400 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Exercise</span>
                </button>
              )}

              {/* Finisher Section */}
              <div className="mt-6 pt-6 border-t border-zinc-700">
                {workout.finisher ? (
                  <div className="space-y-4">
                    {/* Finisher Header */}
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFinisherExpanded(workout.id) }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          workout.finisher.category === 'strength' ? 'bg-blue-500/20 text-blue-400' :
                          workout.finisher.category === 'cardio' ? 'bg-green-500/20 text-green-400' :
                          workout.finisher.category === 'hyrox' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {workout.finisher.category === 'strength' ? 'S' :
                           workout.finisher.category === 'cardio' ? 'C' :
                           workout.finisher.category === 'hyrox' ? 'H' : 'HY'}
                        </div>
                        <div>
                          <input
                            type="text"
                            value={workout.finisher.name}
                            onChange={(e) => updateFinisher(workout.id, { name: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded px-1"
                            placeholder="Finisher Name"
                          />
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-500 capitalize">{workout.finisher.category} • {workout.finisher.exercises.length} exercises</p>
                            {/* EMOM Toggle for cardio/hyrox/hybrid finishers */}
                            {(workout.finisher.category === 'cardio' || workout.finisher.category === 'hyrox' || workout.finisher.category === 'hybrid') && (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <span className="text-zinc-600">•</span>
                                <button
                                  type="button"
                                  onClick={() => updateFinisher(workout.id, { 
                                    isEmom: !workout.finisher?.isEmom,
                                    emomInterval: workout.finisher?.isEmom ? undefined : 60
                                  })}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                    workout.finisher.isEmom 
                                      ? 'bg-yellow-400 text-black' 
                                      : 'badge-inverted hover:opacity-80'
                                  }`}
                                >
                                  EMOM
                                </button>
                                {workout.finisher.isEmom && (
                                  <select
                                    value={workout.finisher.emomInterval || 60}
                                    onChange={(e) => updateFinisher(workout.id, { emomInterval: parseInt(e.target.value) })}
                                    className="px-1 py-0.5 bg-zinc-700 border border-zinc-600 rounded text-white text-[10px] focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                  >
                                    <option value={30}>30s</option>
                                    <option value={45}>45s</option>
                                    <option value={60}>1m</option>
                                    <option value={90}>90s</option>
                                    <option value={120}>2m</option>
                                  </select>
                                )}
                                {/* Superset Toggle */}
                                <span className="text-zinc-600">•</span>
                                <button
                                  type="button"
                                  onClick={() => updateFinisher(workout.id, { 
                                    isSuperset: !workout.finisher?.isSuperset
                                  })}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                    workout.finisher.isSuperset 
                                      ? 'bg-purple-500 text-white' 
                                      : 'bg-zinc-700 text-zinc-400 hover:text-white'
                                  }`}
                                >
                                  SUPERSET
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeFinisher(workout.id) }}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {expandedFinishers.has(workout.id) ? (
                          <ChevronUp className="w-5 h-5 text-zinc-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-zinc-500" />
                        )}
                      </div>
                    </div>

                    {/* Finisher Exercises */}
                    {expandedFinishers.has(workout.id) && (
                      <div className="space-y-3 pl-4 border-l-2 border-zinc-700">
                        {workout.finisher.exercises.map((exercise, idx) => (
                          <div key={exercise.id} className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
                            {renderFinisherExerciseCard(workout, exercise, idx)}
                          </div>
                        ))}

                        {/* Add Exercise/Station to Finisher */}
                        {workout.finisher?.category === 'hyrox' ? (
                          /* Hyrox Finisher: Show station picker + custom option */
                          <div className="space-y-2">
                            <p className="text-xs text-zinc-500">Add Station</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {hyroxStations.map(station => (
                                <button
                                  key={station.value}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); addHyroxStationToFinisher(workout.id, station) }}
                                  className="flex flex-col items-center gap-0.5 p-2 bg-zinc-800/50 border border-zinc-700 hover:border-orange-400/50 hover:bg-orange-500/10 rounded-lg text-zinc-400 hover:text-orange-400 transition-all"
                                >
                                  <span className="text-sm font-bold">{station.icon}</span>
                                  <span className="text-[10px]">{station.label}</span>
                                </button>
                              ))}
                            </div>
                            {/* Custom Exercise Option */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setShowFinisherExerciseSelector(workout.id) }}
                              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-zinc-600 hover:border-yellow-400/50 rounded-lg text-zinc-500 hover:text-yellow-400 text-xs transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Custom Exercise</span>
                            </button>
                          </div>
                        ) : (
                          /* Other Finisher Types: Show exercise selector */
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowFinisherExerciseSelector(workout.id) }}
                            className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-zinc-600 hover:border-yellow-400/50 rounded-xl text-zinc-500 hover:text-yellow-400 text-sm transition-all"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Exercise to Finisher</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Add Finisher Button */
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Add Finisher (Optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {finisherCategories
                        .filter(cat => cat.value !== programType) // Exclude parent program's category
                        .map(cat => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); addFinisher(workout.id, cat.value as any) }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                              cat.value === 'strength' ? 'border-blue-500/30 hover:bg-blue-500/10 text-blue-400' :
                              cat.value === 'cardio' ? 'border-green-500/30 hover:bg-green-500/10 text-green-400' :
                              cat.value === 'hyrox' ? 'border-orange-500/30 hover:bg-orange-500/10 text-orange-400' :
                              'border-purple-500/30 hover:bg-purple-500/10 text-purple-400'
                            }`}
                          >
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Workout Notes */}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Workout Notes</label>
                <textarea
                  value={workout.notes}
                  onChange={(e) => updateWorkout(workout.id, { notes: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                  rows={2}
                  placeholder="Add notes for this workout..."
                />
              </div>

              {/* Recovery Notes (optional) */}
              <div className="border-t border-zinc-700 pt-4">
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Recovery Instructions
                  <span className="text-zinc-600 text-[10px] font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={workout.recoveryNotes || ''}
                  onChange={(e) => updateWorkout(workout.id, { recoveryNotes: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                  rows={2}
                  placeholder="E.g., Stretch for 10 minutes, foam roll quads and hamstrings, take a cold shower..."
                />
              </div>
            </div>
          )}
                </div>
              )}
                  </SortableWorkoutItem>
                  )
                })}
              </div>
            </SortableContext>
          </div>
        ))}
      </DndContext>

      {/* Add Workout Button */}
      <button type="button"
        onClick={addWorkout}
        className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-zinc-700 hover:border-yellow-400 rounded-xl text-zinc-400 hover:text-yellow-400 transition-all group"
      >
        <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-yellow-400/10 flex items-center justify-center transition-colors">
          <Plus className="w-5 h-5" />
        </div>
        <span className="font-medium">Add Workout Day</span>
      </button>

      {/* Exercise Selector Modal */}
      {showExerciseSelector && (
        <ExerciseSelector
          onSelect={(exercise) => addExercise(showExerciseSelector, exercise)}
          onSelectSuperset={(exercises) => addSuperset(showExerciseSelector, exercises)}
          onClose={() => setShowExerciseSelector(null)}
          allowSuperset={true}
          programType={programType}
        />
      )}

      {/* Finisher Exercise Selector Modal */}
      {showFinisherExerciseSelector && (
        <ExerciseSelector
          onSelect={(exercise) => addExerciseToFinisher(showFinisherExerciseSelector, exercise)}
          onSelectSuperset={(exercises) => addSupersetToFinisher(showFinisherExerciseSelector, exercises)}
          onClose={() => setShowFinisherExerciseSelector(null)}
          allowSuperset={true}
          programType={workouts.find(w => w.id === showFinisherExerciseSelector)?.finisher?.category}
        />
      )}

      {/* Warmup Exercise Selector Modal */}
      {showWarmupSelector && (
        <ExerciseSelector
          onSelect={(exercise) => addWarmupExercise(showWarmupSelector, exercise)}
          onClose={() => setShowWarmupSelector(null)}
          allowSuperset={false}
          programType="stretching" // Show mobility/stretching exercises by default
        />
      )}

      {/* Replace Exercise Selector Modal */}
      {replaceExercise && (
        <ExerciseSelector
          onSelect={(exercise) => replaceExerciseWith(replaceExercise.workoutId, replaceExercise.exerciseId, exercise)}
          onClose={() => setReplaceExercise(null)}
          allowSuperset={false}
          programType={programType}
        />
      )}

      {/* Workout Template Modal */}
      {templateModal && (
        <WorkoutTemplateModal
          mode={templateModal.mode}
          workoutData={templateModal.mode === 'save' ? getWorkoutDataForTemplate(templateModal.workoutId) : undefined}
          category={programType || 'strength'}
          onClose={() => setTemplateModal(null)}
          onLoad={(template) => loadTemplateIntoWorkout(templateModal.workoutId, template.workout_data)}
          onSave={async () => {
            // Save was already handled by the modal component via the API
            setTemplateModal(null)
          }}
        />
      )}
    </div>
  )
}
