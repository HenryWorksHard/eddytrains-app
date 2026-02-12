'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Check, 
  Dumbbell, 
  Heart, 
  Zap,
  Mail,
  Calendar,
  Clock,
  Shield,
  Edit2,
  Key,
  User as UserIcon,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Apple,
  Settings2,
  Weight
} from 'lucide-react'
import { createClient } from '@/app/lib/supabase/client'
import UserSchedule from './UserSchedule'
import UserProgressGallery from './UserProgressGallery'
import ClientTabs, { TabType } from './components/ClientTabs'
import ProgressTab from './components/ProgressTab'
import ProfileTab from './components/ProfileTab'
import BMRCalculator from '@/components/BMRCalculator'

interface User {
  id: string
  slug: string | null
  email: string
  full_name: string | null
  is_active: boolean
  status: string | null
  temp_password: string | null
  password_changed: boolean | null
  profile_picture_url: string | null
  created_at: string
  updated_at: string
  goals: string | null
  presenting_condition: string | null
  medical_history: string | null
}

interface Program {
  id: string
  name: string
  category: string
  difficulty: string
  description: string | null
}

interface ClientProgram {
  id: string
  program_id: string
  start_date: string
  end_date: string | null
  duration_weeks: number
  phase_name: string | null
  is_active: boolean
  program: {
    id: string
    name: string
    category: string
    difficulty: string
  } | null
}

interface ExerciseSet {
  id: string
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket?: string
  rest_seconds?: number
  weight_type?: string
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

interface CustomizedSet {
  workout_exercise_id: string
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket: string
  weight_type: string
  notes: string
  // Cardio fields
  cardio_type?: string
  cardio_value?: string
  cardio_unit?: string
  heart_rate_zone?: number
  work_time?: string
  rest_time?: string
  // Hyrox fields
  hyrox_station?: string
  hyrox_distance?: string
  hyrox_unit?: string
  hyrox_target_time?: string
  hyrox_weight_class?: string
}

interface Client1RM {
  id?: string
  exercise_name: string
  weight_kg: number
}

// Common compound lifts for 1RM tracking
const COMMON_LIFTS = [
  'Squat',
  'Bench Press',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Front Squat',
  'Romanian Deadlift',
  'Incline Bench Press'
]

export default function UserProfilePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabType) || 'profile'
  const rawId = params.id as string
  const userId = decodeURIComponent(rawId)
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [clientPrograms, setClientPrograms] = useState<ClientProgram[]>([])
  
  // Client info fields
  const [editingClientInfo, setEditingClientInfo] = useState(false)
  const [savingClientInfo, setSavingClientInfo] = useState(false)
  const [clientGoals, setClientGoals] = useState('')
  const [clientPresentingCondition, setClientPresentingCondition] = useState('')
  const [clientMedicalHistory, setClientMedicalHistory] = useState('')

  // Assign Program Modal State
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [availablePrograms, setAvailablePrograms] = useState<Program[]>([])
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [assignDuration, setAssignDuration] = useState(4)
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split('T')[0])
  const [phaseName, setPhaseName] = useState('')
  const [assigning, setAssigning] = useState(false)
  
  // Wizard state
  const [wizardStep, setWizardStep] = useState<'select' | 'customize'>('select')
  const [programWorkouts, setProgramWorkouts] = useState<ProgramWorkout[]>([])
  const [customizedSets, setCustomizedSets] = useState<Map<string, CustomizedSet>>(new Map())
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set())
  const [loadingWorkouts, setLoadingWorkouts] = useState(false)

  // 1RM State
  const [client1RMs, setClient1RMs] = useState<Client1RM[]>([])
  const [editing1RM, setEditing1RM] = useState(false)
  const [saving1RM, setSaving1RM] = useState(false)

  // Nutrition State
  const [clientNutrition, setClientNutrition] = useState<{
    id: string
    plan_id: string
    plan_name: string
    calories: number
    protein: number
    carbs: number
    fats: number
    notes?: string
    created_by_type?: 'trainer' | 'client'
  } | null>(null)
  const [clientSelfNutrition, setClientSelfNutrition] = useState<{
    id: string
    calories: number
    protein: number
    carbs: number
    fats: number
    created_by_type: 'client'
  } | null>(null)
  
  // Tab navigation - use URL param if provided
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [availableNutritionPlans, setAvailableNutritionPlans] = useState<{
    id: string
    name: string
    calories: number
    protein: number
    carbs: number
    fats: number
  }[]>([])
  const [showNutritionModal, setShowNutritionModal] = useState(false)
  const [selectedNutritionPlan, setSelectedNutritionPlan] = useState<string | null>(null)
  const [nutritionNotes, setNutritionNotes] = useState('')
  const [assigningNutrition, setAssigningNutrition] = useState(false)
  const [customNutritionMode, setCustomNutritionMode] = useState(false)
  const [customCalories, setCustomCalories] = useState(2000)
  const [customProtein, setCustomProtein] = useState(150)
  const [customCarbs, setCustomCarbs] = useState(200)
  const [customFats, setCustomFats] = useState(70)

  // Clone User State
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<{ id: string; email: string; full_name: string | null }[]>([])
  const [selectedCloneUser, setSelectedCloneUser] = useState<string | null>(null)
  const [clonePrograms, setClonePrograms] = useState(true)
  const [cloneNutrition, setCloneNutrition] = useState(true)
  const [cloning, setCloning] = useState(false)

  // Workout History State
  const [workoutHistory, setWorkoutHistory] = useState<{
    id: string
    date: string
    workoutName: string
    programName: string
    totalSets: number
    totalVolume: number
    exercises: { name: string; sets: { set: number; weight: number; reps: number }[] }[]
  }[]>([])
  const [expandedWorkoutLog, setExpandedWorkoutLog] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [permissions, setPermissions] = useState({
    programs: false,
    nutrition: false,
  })

  useEffect(() => {
    fetchUser()
  }, [userId])
  
  useEffect(() => {
    if (user?.id) {
      fetchClientPrograms(user.id)
      fetchClient1RMs(user.id)
      fetchClientNutrition(user.id)
      fetchWorkoutHistory(user.id)
    }
  }, [user?.id])

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/users/${userId}`)
      const data = await response.json()
      
      if (data.error) {
        setError(data.error)
        return
      }
      
      setUser(data.user)
      setFullName(data.user.full_name || '')
      setEmail(data.user.email || '')
      setClientGoals(data.user.goals || '')
      setClientPresentingCondition(data.user.presenting_condition || '')
      setClientMedicalHistory(data.user.medical_history || '')
      setPermissions({
        programs: data.user.user_permissions?.[0]?.can_access_strength || data.user.can_access_strength || false,
        nutrition: data.user.can_access_nutrition || false,
      })
    } catch (err) {
      setError('Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  const fetchClientPrograms = async (userUuid: string) => {
    try {
      const { data, error } = await supabase
        .from('client_programs')
        .select(`
          id,
          program_id,
          start_date,
          end_date,
          duration_weeks,
          phase_name,
          is_active,
          program:programs (id, name, category, difficulty)
        `)
        .eq('client_id', userUuid)
        .order('start_date', { ascending: false })
      
      if (error) throw error
      const transformed = (data || []).map(cp => ({
        ...cp,
        program: Array.isArray(cp.program) ? cp.program[0] : cp.program
      }))
      setClientPrograms(transformed)
    } catch (err) {
      console.error('Failed to fetch client programs:', err)
    }
  }

  const fetchClient1RMs = async (userUuid: string) => {
    try {
      const response = await fetch(`/api/users/${userUuid}/1rms`)
      const { data, error } = await response.json()
      
      if (error) {
        console.error('Failed to fetch 1RMs:', error)
        setClient1RMs(COMMON_LIFTS.map(name => ({ exercise_name: name, weight_kg: 0 })))
        return
      }
      
      // Merge with common lifts (show all, even if not set)
      const existingMap = new Map<string, Client1RM>((data || []).map((rm: Client1RM) => [rm.exercise_name, rm]))
      const merged: Client1RM[] = COMMON_LIFTS.map(name => 
        existingMap.get(name) ?? { exercise_name: name, weight_kg: 0 }
      )
      // Add any custom lifts not in COMMON_LIFTS
      data?.forEach((rm: Client1RM) => {
        if (!COMMON_LIFTS.includes(rm.exercise_name)) {
          merged.push(rm)
        }
      })
      setClient1RMs(merged)
    } catch (err) {
      console.error('Failed to fetch 1RMs:', err)
      setClient1RMs(COMMON_LIFTS.map(name => ({ exercise_name: name, weight_kg: 0 })))
    }
  }

  const save1RMs = async () => {
    if (!user) return
    setSaving1RM(true)
    
    try {
      const response = await fetch(`/api/users/${user.id}/1rms`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oneRMs: client1RMs })
      })
      
      const result = await response.json()
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to save')
      }
      
      setEditing1RM(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      // Refresh the data
      fetchClient1RMs(user.id)
    } catch (err) {
      console.error('Failed to save 1RMs:', err)
      setError('Failed to save 1RMs')
    } finally {
      setSaving1RM(false)
    }
  }

  const update1RM = (exerciseName: string, weightKg: number) => {
    setClient1RMs(prev => prev.map(rm => 
      rm.exercise_name === exerciseName ? { ...rm, weight_kg: weightKg } : rm
    ))
  }

  const fetchClientNutrition = async (userUuid: string) => {
    try {
      // Fetch trainer-assigned plan
      const { data: trainerData, error: trainerError } = await supabase
        .from('client_nutrition')
        .select(`
          id,
          plan_id,
          notes,
          custom_calories,
          custom_protein,
          custom_carbs,
          custom_fats,
          created_by_type,
          nutrition_plans:plan_id (id, name, calories, protein, carbs, fats)
        `)
        .eq('client_id', userUuid)
        .eq('is_active', true)
        .eq('created_by_type', 'trainer')
        .single()
      
      if (trainerError && trainerError.code !== 'PGRST116') console.error(trainerError)
      
      if (trainerData) {
        const plan = Array.isArray(trainerData.nutrition_plans) ? trainerData.nutrition_plans[0] : trainerData.nutrition_plans
        setClientNutrition({
          id: trainerData.id,
          plan_id: trainerData.plan_id,
          plan_name: plan?.name || 'Custom Plan',
          calories: trainerData.custom_calories || plan?.calories || 0,
          protein: trainerData.custom_protein || plan?.protein || 0,
          carbs: trainerData.custom_carbs || plan?.carbs || 0,
          fats: trainerData.custom_fats || plan?.fats || 0,
          notes: trainerData.notes,
          created_by_type: 'trainer'
        })
      } else {
        setClientNutrition(null)
      }

      // Fetch client-created plan
      const { data: clientData, error: clientError } = await supabase
        .from('client_nutrition')
        .select(`
          id,
          custom_calories,
          custom_protein,
          custom_carbs,
          custom_fats
        `)
        .eq('client_id', userUuid)
        .eq('is_active', true)
        .eq('created_by_type', 'client')
        .single()
      
      if (clientError && clientError.code !== 'PGRST116') console.error(clientError)
      
      if (clientData) {
        setClientSelfNutrition({
          id: clientData.id,
          calories: clientData.custom_calories || 0,
          protein: clientData.custom_protein || 0,
          carbs: clientData.custom_carbs || 0,
          fats: clientData.custom_fats || 0,
          created_by_type: 'client'
        })
      } else {
        setClientSelfNutrition(null)
      }
    } catch (err) {
      console.error('Failed to fetch client nutrition:', err)
    }
  }

  const fetchAvailableNutritionPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('nutrition_plans')
        .select('id, name, calories, protein, carbs, fats')
        .order('name')
      
      if (error) throw error
      setAvailableNutritionPlans(data || [])
    } catch (err) {
      console.error('Failed to fetch nutrition plans:', err)
    }
  }

  const assignNutritionPlan = async () => {
    if (!user || !selectedNutritionPlan) return
    setAssigningNutrition(true)
    
    try {
      // Deactivate any existing nutrition assignments
      await supabase
        .from('client_nutrition')
        .update({ is_active: false })
        .eq('client_id', user.id)
      
      // Create new assignment
      if (customNutritionMode) {
        // Custom nutrition - save to client_nutrition with custom values
        const { error } = await supabase
          .from('client_nutrition')
          .upsert({
            client_id: user.id,
            plan_id: null,
            custom_calories: customCalories,
            custom_protein: customProtein,
            custom_carbs: customCarbs,
            custom_fats: customFats,
            notes: nutritionNotes || null,
            created_by_type: 'trainer',
            is_active: true
          }, { onConflict: 'client_id' })
        
        if (error) throw error
      } else {
        // Template-based assignment
        const selectedPlan = availableNutritionPlans.find(p => p.id === selectedNutritionPlan)
        const { error } = await supabase
          .from('client_nutrition')
          .upsert({
            client_id: user.id,
            plan_id: selectedNutritionPlan,
            custom_calories: selectedPlan?.calories || 2000,
            custom_protein: selectedPlan?.protein || 150,
            custom_carbs: selectedPlan?.carbs || 200,
            custom_fats: selectedPlan?.fats || 70,
            notes: nutritionNotes || null,
            created_by_type: 'trainer',
            is_active: true
          }, { onConflict: 'client_id' })
        
        if (error) throw error
      }
      
      setShowNutritionModal(false)
      setSelectedNutritionPlan(null)
      setNutritionNotes('')
      setCustomNutritionMode(false)
      fetchClientNutrition(user.id)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to assign nutrition plan:', err)
      setError('Failed to assign nutrition plan')
    } finally {
      setAssigningNutrition(false)
    }
  }

  const removeNutritionPlan = async () => {
    if (!user || !clientNutrition) return
    
    try {
      await supabase
        .from('client_nutrition')
        .update({ is_active: false })
        .eq('id', clientNutrition.id)
      
      setClientNutrition(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to remove nutrition plan:', err)
    }
  }

  const fetchWorkoutHistory = async (userUuid: string) => {
    try {
      // Get workout logs
      const { data: workoutLogs, error: logsError } = await supabase
        .from('workout_logs')
        .select(`
          id,
          workout_id,
          completed_at,
          program_workouts (
            id,
            name,
            programs (
              id,
              name
            )
          )
        `)
        .eq('client_id', userUuid)
        .order('completed_at', { ascending: false })
        .limit(10)

      if (logsError) throw logsError

      // Get set logs
      const workoutLogIds = workoutLogs?.map(log => log.id) || []
      
      const { data: setLogs } = await supabase
        .from('set_logs')
        .select('workout_log_id, exercise_id, set_number, weight_kg, reps_completed')
        .in('workout_log_id', workoutLogIds)

      // Get exercise names
      const exerciseIds = [...new Set(setLogs?.map(log => log.exercise_id) || [])]
      
      const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('id, exercise_name')
        .in('id', exerciseIds)

      const exerciseLookup = new Map(exercises?.map(e => [e.id, e.exercise_name]) || [])

      // Transform data
      const history = workoutLogs?.map(log => {
        const workout = log.program_workouts as unknown as { id: string; name: string; programs: { id: string; name: string } | null } | null
        const workoutSetLogs = setLogs?.filter(sl => sl.workout_log_id === log.id) || []
        
        // Group by exercise
        const exerciseMap = new Map<string, { name: string; sets: { set: number; weight: number; reps: number }[] }>()
        
        workoutSetLogs.forEach(sl => {
          const exerciseName = exerciseLookup.get(sl.exercise_id) || 'Unknown Exercise'
          if (!exerciseMap.has(sl.exercise_id)) {
            exerciseMap.set(sl.exercise_id, { name: exerciseName, sets: [] })
          }
          exerciseMap.get(sl.exercise_id)!.sets.push({
            set: sl.set_number,
            weight: sl.weight_kg || 0,
            reps: sl.reps_completed || 0
          })
        })

        // Sort sets
        exerciseMap.forEach(ex => {
          ex.sets.sort((a, b) => a.set - b.set)
        })

        const totalSets = workoutSetLogs.length
        const totalVolume = workoutSetLogs.reduce((sum, sl) => sum + ((sl.weight_kg || 0) * (sl.reps_completed || 0)), 0)

        return {
          id: log.id,
          date: log.completed_at,
          workoutName: workout?.name || 'Workout',
          programName: workout?.programs?.name || '',
          totalSets,
          totalVolume,
          exercises: Array.from(exerciseMap.values())
        }
      }) || []

      setWorkoutHistory(history)
    } catch (err) {
      console.error('Failed to fetch workout history:', err)
    }
  }

  const fetchAvailablePrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name, category, difficulty, description')
        .eq('is_active', true)
        .order('name')
      
      if (error) throw error
      setAvailablePrograms(data || [])
    } catch (err) {
      console.error('Failed to fetch programs:', err)
    }
  }

  const openAssignModal = () => {
    fetchAvailablePrograms()
    setSelectedProgram(null)
    setAssignDuration(4)
    setAssignStartDate(new Date().toISOString().split('T')[0])
    setPhaseName('')
    setWizardStep('select')
    setProgramWorkouts([])
    setCustomizedSets(new Map())
    setExpandedWorkouts(new Set())
    setShowAssignModal(true)
  }

  const openCloneModal = () => {
    fetchAvailableUsers()
    setSelectedCloneUser(null)
    setClonePrograms(true)
    setCloneNutrition(true)
    setShowCloneModal(true)
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
      
      // Sort workout_exercises and their sets
      const sortedWorkouts = (workouts || []).map(w => ({
        ...w,
        workout_exercises: (w.workout_exercises || [])
          .sort((a: WorkoutExercise, b: WorkoutExercise) => a.order_index - b.order_index)
          .map((ex: WorkoutExercise) => ({
            ...ex,
            exercise_sets: (ex.exercise_sets || [])
              .sort((a: ExerciseSet, b: ExerciseSet) => a.set_number - b.set_number)
              .map((set: ExerciseSet) => ({
                ...set,
                rest_bracket: set.rest_bracket || `${set.rest_seconds || 90}`
              }))
          }))
      }))
      
      setProgramWorkouts(sortedWorkouts)
      
      // Initialize customized sets with default values
      const initialCustomizations = new Map<string, CustomizedSet>()
      sortedWorkouts.forEach(workout => {
        workout.workout_exercises.forEach((exercise: WorkoutExercise) => {
          exercise.exercise_sets.forEach((set: ExerciseSet) => {
            const key = `${exercise.id}-${set.set_number}`
            initialCustomizations.set(key, {
              workout_exercise_id: exercise.id,
              set_number: set.set_number,
              reps: set.reps,
              intensity_type: set.intensity_type,
              intensity_value: set.intensity_value,
              rest_bracket: set.rest_bracket || '90-120',
              weight_type: set.weight_type || 'freeweight',
              notes: set.notes || ''
            })
          })
        })
      })
      setCustomizedSets(initialCustomizations)
      
      // Expand first workout by default
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

  const updateCustomizedSet = (exerciseId: string, setNumber: number, field: keyof CustomizedSet, value: string) => {
    const key = `${exerciseId}-${setNumber}`
    const existing = customizedSets.get(key)
    if (existing) {
      const updated = new Map(customizedSets)
      updated.set(key, { ...existing, [field]: value })
      setCustomizedSets(updated)
    }
  }

  // Update ALL sets for an exercise at once
  const updateAllExerciseSets = (exerciseId: string, field: keyof CustomizedSet, value: string) => {
    const updated = new Map(customizedSets)
    // Find all sets for this exercise and update them
    updated.forEach((setData, key) => {
      if (key.startsWith(`${exerciseId}-`)) {
        updated.set(key, { ...setData, [field]: value })
      }
    })
    setCustomizedSets(updated)
  }

  // Get the first set's values for an exercise (to display in the single row)
  const getExerciseSetValues = (exerciseId: string) => {
    const firstSetKey = `${exerciseId}-1`
    return customizedSets.get(firstSetKey)
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

  // Clone from another user
  const fetchAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'client')
        .neq('id', user?.id || '')
        .order('full_name')
      
      if (!error && data) {
        setAvailableUsers(data)
      }
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  const handleClone = async () => {
    if (!selectedCloneUser || !user) return
    
    setCloning(true)
    try {
      const response = await fetch(`/api/users/${user.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUserId: selectedCloneUser,
          includePrograms: clonePrograms,
          includeNutrition: cloneNutrition
        })
      })
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setShowCloneModal(false)
      setSelectedCloneUser(null)
      
      // Refresh data
      if (user) {
        fetchClientPrograms(user.id)
        fetchClientNutrition(user.id)
      }
      
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Clone failed:', err)
      setError('Failed to clone user setup')
    } finally {
      setCloning(false)
    }
  }

  const handleAssignProgram = async () => {
    if (!selectedProgram || !user) return
    
    setAssigning(true)
    try {
      // Use selected start date
      const startDate = new Date(assignStartDate)
      
      // Calculate end date based on start date and duration
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + (assignDuration * 7))
      
      // Insert the client program assignment
      const { data: clientProgram, error: programError } = await supabase
        .from('client_programs')
        .insert({
          client_id: user.id,
          program_id: selectedProgram.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          duration_weeks: assignDuration,
          phase_name: phaseName || null,
          is_active: true
        })
        .select()
        .single()
      
      if (programError) throw programError
      
      // Insert customized sets if we have any
      if (customizedSets.size > 0 && clientProgram) {
        const setsToInsert = Array.from(customizedSets.values()).map(set => ({
          client_program_id: clientProgram.id,
          workout_exercise_id: set.workout_exercise_id,
          set_number: set.set_number,
          reps: set.reps,
          intensity_type: set.intensity_type,
          intensity_value: set.intensity_value,
          rest_bracket: set.rest_bracket,
          weight_type: set.weight_type,
          notes: set.notes || null,
          // Cardio fields
          cardio_type: set.cardio_type || null,
          cardio_value: set.cardio_value || null,
          cardio_unit: set.cardio_unit || null,
          heart_rate_zone: set.heart_rate_zone ? parseInt(String(set.heart_rate_zone)) : null,
          work_time: set.work_time || null,
          rest_time: set.rest_time || null,
          // Hyrox fields
          hyrox_station: set.hyrox_station || null,
          hyrox_distance: set.hyrox_distance || null,
          hyrox_unit: set.hyrox_unit || null,
          hyrox_target_time: set.hyrox_target_time || null,
          hyrox_weight_class: set.hyrox_weight_class || null
        }))
        
        const { error: setsError } = await supabase
          .from('client_exercise_sets')
          .insert(setsToInsert)
        
        if (setsError) {
          console.error('Failed to save custom sets:', setsError)
          // Don't throw - program was assigned successfully
        }
      }
      
      setShowAssignModal(false)
      fetchClientPrograms(user.id)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to assign program:', err)
      setError('Failed to assign program')
    } finally {
      setAssigning(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, permissions })
      })

      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to update user')
        return
      }

      setSuccess(true)
      setEditMode(false)
      fetchUser()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError('Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const saveClientInfo = async () => {
    if (!user) return
    setSavingClientInfo(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          goals: clientGoals || null,
          presenting_condition: clientPresentingCondition || null,
          medical_history: clientMedicalHistory || null
        })
        .eq('id', user.id)

      if (error) throw error

      setEditingClientInfo(false)
      fetchUser()
    } catch (err) {
      console.error('Failed to save client info:', err)
      setError('Failed to save client info')
    } finally {
      setSavingClientInfo(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to delete user')
        setDeleting(false)
        return
      }

      router.push('/users')
      router.refresh()
    } catch (err) {
      setError('Failed to delete user')
      setDeleting(false)
    }
  }

  const permissionOptions = [
    { key: 'programs', name: 'Programs', icon: Dumbbell, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { key: 'nutrition', name: 'Nutrition', icon: Apple, color: 'text-green-400', bg: 'bg-green-500/10' },
  ]

  const getCategoryColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'strength': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'cardio': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'hyrox': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    }
  }

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner': return 'bg-green-500/10 text-green-400'
      case 'intermediate': return 'bg-yellow-500/10 text-yellow-400'
      case 'advanced': return 'bg-red-500/10 text-red-400'
      default: return 'bg-zinc-500/10 text-zinc-400'
    }
  }

  const getCategoryIcon = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'strength': return Dumbbell
      case 'cardio': return Heart
      case 'hyrox': return Zap
      default: return Dumbbell
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-4xl">
        <Link href="/users" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">User not found</h2>
          <p className="text-zinc-400">This user may have been deleted.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Clone from User Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div>
                <h3 className="text-xl font-semibold text-white">Clone from User</h3>
                <p className="text-sm text-zinc-500">Copy programs and nutrition from another user</p>
              </div>
              <button onClick={() => setShowCloneModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Select Source User</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableUsers.map(u => (
                    <div
                      key={u.id}
                      onClick={() => setSelectedCloneUser(u.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedCloneUser === u.id
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white font-medium text-sm">
                        {u.full_name?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{u.full_name || 'No name'}</p>
                        <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                      </div>
                      {selectedCloneUser === u.id && (
                        <Check className="w-5 h-5 text-yellow-400" />
                      )}
                    </div>
                  ))}
                  {availableUsers.length === 0 && (
                    <p className="text-zinc-500 text-center py-4">No other users available</p>
                  )}
                </div>
              </div>

              {/* Clone Options */}
              {selectedCloneUser && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-zinc-400">What to clone:</p>
                  <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clonePrograms}
                      onChange={(e) => setClonePrograms(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-600 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-0 bg-zinc-700"
                    />
                    <div>
                      <p className="font-medium text-white">Programs & Custom Sets</p>
                      <p className="text-xs text-zinc-500">Copy all active programs with their customizations</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cloneNutrition}
                      onChange={(e) => setCloneNutrition(e.target.checked)}
                      className="w-5 h-5 rounded border-zinc-600 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-0 bg-zinc-700"
                    />
                    <div>
                      <p className="font-medium text-white">Nutrition Plan</p>
                      <p className="text-xs text-zinc-500">Copy their assigned nutrition plan</p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-zinc-800">
              <button
                onClick={() => setShowCloneModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={cloning || !selectedCloneUser || (!clonePrograms && !cloneNutrition)}
                className="flex items-center gap-2 px-6 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-medium rounded-xl transition-colors"
              >
                {cloning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Clone Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Program Modal - Wizard */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`bg-zinc-900 rounded-2xl border border-zinc-800 w-full ${wizardStep === 'customize' ? 'max-w-4xl max-h-[90vh] overflow-hidden flex flex-col' : 'max-w-lg'}`}>
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
                    {wizardStep === 'select' ? 'Assign Program' : 'Customize Sets'}
                  </h3>
                  <p className="text-sm text-zinc-500">
                    {wizardStep === 'select' 
                      ? `for @${user.slug || user.full_name?.toLowerCase().replace(/\s/g, '') || 'user'}`
                      : selectedProgram?.name
                    }
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            {/* Step 1: Select Program */}
            {wizardStep === 'select' && (
              <>
                <div className="p-6 space-y-6">
                  {/* Program Selection */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Select Program</label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availablePrograms.map(program => {
                        const Icon = getCategoryIcon(program.category)
                        return (
                          <div
                            key={program.id}
                            onClick={() => setSelectedProgram(program)}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              selectedProgram?.id === program.id
                                ? 'border-yellow-400 bg-yellow-400/10'
                                : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getCategoryColor(program.category)}`}>
                              <Icon className="w-5 h-5" />
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
                        )
                      })}
                      {availablePrograms.length === 0 && (
                        <p className="text-zinc-500 text-center py-4">No programs available</p>
                      )}
                    </div>
                  </div>

                  {/* Phase Name & Duration */}
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
                        <p className="text-xs text-zinc-500 mt-1">Helps identify this assignment when the same program is used multiple times</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">
                          Duration
                        </label>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="1"
                            max="24"
                            value={assignDuration}
                            onChange={(e) => setAssignDuration(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                          />
                          <div className="w-24 text-center">
                            <span className="text-2xl font-bold text-white">{assignDuration}</span>
                            <span className="text-zinc-400 ml-1">weeks</span>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500 mt-1">
                          <span>1 week</span>
                          <span>24 weeks</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={assignStartDate}
                          onChange={(e) => setAssignStartDate(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                        <p className="text-xs text-zinc-500 mt-1">
                          Program will run from {new Date(assignStartDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} to {new Date(new Date(assignStartDate).getTime() + assignDuration * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-zinc-800">
                  <button
                    onClick={() => setShowAssignModal(false)}
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
                    Customize Sets
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
            
            {/* Step 2: Customize Sets */}
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
                      <p className="text-zinc-500 text-sm mt-2">You can still assign it with default values.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {phaseName && (
                        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-4 py-3">
                          <p className="text-sm text-yellow-400 font-medium">{phaseName}</p>
                          <p className="text-xs text-zinc-400">{assignDuration} weeks • Customize the intensity below</p>
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
                            <div className="border-t border-zinc-800">
                              {/* STRENGTH / HYBRID(strength mode) */}
                              {(selectedProgram?.category === 'strength' || selectedProgram?.category === 'hybrid') && (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-zinc-500 uppercase bg-zinc-800/20">
                                      <th className="px-4 py-2 text-left">Exercise</th>
                                      <th className="px-4 py-2 text-left w-16">Sets</th>
                                      <th className="px-4 py-2 text-left">Reps</th>
                                      <th className="px-4 py-2 text-left">Intensity</th>
                                      <th className="px-4 py-2 text-left">Rest</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                {workout.workout_exercises.map((exercise: WorkoutExercise, exIdx: number) => {
                                  const setValues = getExerciseSetValues(exercise.id)
                                  const firstSet = exercise.exercise_sets[0]
                                  return (
                                    <tr key={exercise.id} className="border-t border-zinc-800/30">
                                      <td className="px-4 py-3">
                                        <span className="text-zinc-500 font-mono text-xs mr-2">{exIdx + 1}.</span>
                                        <span className="text-white font-medium">{exercise.exercise_name}</span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="text-zinc-400 font-mono">{exercise.exercise_sets.length}</span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={setValues?.reps || firstSet?.reps || ''}
                                          onChange={(e) => updateAllExerciseSets(exercise.id, 'reps', e.target.value)}
                                          className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                          placeholder="8-12"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                          <select
                                            value={setValues?.intensity_type || firstSet?.intensity_type || 'rir'}
                                            onChange={(e) => updateAllExerciseSets(exercise.id, 'intensity_type', e.target.value)}
                                            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                          >
                                            <option value="rir">RIR</option>
                                            <option value="rpe">RPE</option>
                                            <option value="percentage">%</option>
                                            <option value="failure">Failure</option>
                                          </select>
                                          {(setValues?.intensity_type || firstSet?.intensity_type) !== 'failure' && (
                                            <input
                                              type="text"
                                              value={setValues?.intensity_value || firstSet?.intensity_value || ''}
                                              onChange={(e) => updateAllExerciseSets(exercise.id, 'intensity_value', e.target.value)}
                                              className="w-14 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                              placeholder="2"
                                            />
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <select
                                          value={setValues?.rest_bracket || firstSet?.rest_bracket || '90-120'}
                                          onChange={(e) => updateAllExerciseSets(exercise.id, 'rest_bracket', e.target.value)}
                                          className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                        >
                                          <option value="30-60">30-60s</option>
                                          <option value="60-90">60-90s</option>
                                          <option value="90-120">90-120s</option>
                                          <option value="120-180">2-3min</option>
                                          <option value="180-300">3-5min</option>
                                        </select>
                                      </td>
                                    </tr>
                                  )
                                })}
                                  </tbody>
                                </table>
                              )}

                              {/* CARDIO */}
                              {selectedProgram?.category === 'cardio' && (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-zinc-500 uppercase bg-zinc-800/20">
                                      <th className="px-4 py-2 text-left">Exercise</th>
                                      <th className="px-4 py-2 text-left">Type</th>
                                      <th className="px-4 py-2 text-left">Value</th>
                                      <th className="px-4 py-2 text-left">HR Zone</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                {workout.workout_exercises.map((exercise: WorkoutExercise, exIdx: number) => {
                                  const setValues = getExerciseSetValues(exercise.id)
                                  const firstSet = exercise.exercise_sets[0] as any
                                  return (
                                    <tr key={exercise.id} className="border-t border-zinc-800/30">
                                      <td className="px-4 py-3">
                                        <span className="text-zinc-500 font-mono text-xs mr-2">{exIdx + 1}.</span>
                                        <span className="text-white font-medium">{exercise.exercise_name}</span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <select
                                          value={setValues?.cardio_type || firstSet?.cardio_type || 'duration'}
                                          onChange={(e) => updateAllExerciseSets(exercise.id, 'cardio_type', e.target.value)}
                                          className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                        >
                                          <option value="duration">Duration</option>
                                          <option value="distance">Distance</option>
                                          <option value="calories">Calories</option>
                                          <option value="intervals">Intervals</option>
                                        </select>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                          <input
                                            type="text"
                                            value={setValues?.cardio_value || firstSet?.cardio_value || ''}
                                            onChange={(e) => updateAllExerciseSets(exercise.id, 'cardio_value', e.target.value)}
                                            className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                            placeholder="20"
                                          />
                                          <select
                                            value={setValues?.cardio_unit || firstSet?.cardio_unit || 'min'}
                                            onChange={(e) => updateAllExerciseSets(exercise.id, 'cardio_unit', e.target.value)}
                                            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                          >
                                            <option value="min">min</option>
                                            <option value="km">km</option>
                                            <option value="m">m</option>
                                            <option value="cal">cal</option>
                                          </select>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <select
                                          value={setValues?.heart_rate_zone || firstSet?.heart_rate_zone || ''}
                                          onChange={(e) => updateAllExerciseSets(exercise.id, 'heart_rate_zone', e.target.value)}
                                          className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                        >
                                          <option value="">-</option>
                                          <option value="1">Z1 (50-60%)</option>
                                          <option value="2">Z2 (60-70%)</option>
                                          <option value="3">Z3 (70-80%)</option>
                                          <option value="4">Z4 (80-90%)</option>
                                          <option value="5">Z5 (90-100%)</option>
                                        </select>
                                      </td>
                                    </tr>
                                  )
                                })}
                                  </tbody>
                                </table>
                              )}

                              {/* HYROX */}
                              {selectedProgram?.category === 'hyrox' && (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-xs text-zinc-500 uppercase bg-zinc-800/20">
                                      <th className="px-4 py-2 text-left">Exercise</th>
                                      <th className="px-4 py-2 text-left">Station</th>
                                      <th className="px-4 py-2 text-left">Distance</th>
                                      <th className="px-4 py-2 text-left">Target</th>
                                      <th className="px-4 py-2 text-left">Class</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                {workout.workout_exercises.map((exercise: WorkoutExercise, exIdx: number) => {
                                  const setValues = getExerciseSetValues(exercise.id)
                                  const firstSet = exercise.exercise_sets[0] as any
                                  return (
                                    <tr key={exercise.id} className="border-t border-zinc-800/30">
                                      <td className="px-4 py-3">
                                        <span className="text-zinc-500 font-mono text-xs mr-2">{exIdx + 1}.</span>
                                        <span className="text-white font-medium">{exercise.exercise_name}</span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <select
                                          value={setValues?.hyrox_station || firstSet?.hyrox_station || 'run'}
                                          onChange={(e) => updateAllExerciseSets(exercise.id, 'hyrox_station', e.target.value)}
                                          className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                        >
                                          <option value="run">Run</option>
                                          <option value="skierg">SkiErg</option>
                                          <option value="sled_push">Sled Push</option>
                                          <option value="sled_pull">Sled Pull</option>
                                          <option value="burpee_broad_jump">Burpee BJ</option>
                                          <option value="row">Row</option>
                                          <option value="farmers_carry">Farmers</option>
                                          <option value="sandbag_lunges">Sandbag</option>
                                          <option value="wall_balls">Wall Balls</option>
                                        </select>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                          <input
                                            type="text"
                                            value={setValues?.hyrox_distance || firstSet?.hyrox_distance || ''}
                                            onChange={(e) => updateAllExerciseSets(exercise.id, 'hyrox_distance', e.target.value)}
                                            className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                            placeholder="1000"
                                          />
                                          <select
                                            value={setValues?.hyrox_unit || firstSet?.hyrox_unit || 'm'}
                                            onChange={(e) => updateAllExerciseSets(exercise.id, 'hyrox_unit', e.target.value)}
                                            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                          >
                                            <option value="m">m</option>
                                            <option value="km">km</option>
                                            <option value="reps">reps</option>
                                          </select>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="text"
                                          value={setValues?.hyrox_target_time || firstSet?.hyrox_target_time || ''}
                                          onChange={(e) => updateAllExerciseSets(exercise.id, 'hyrox_target_time', e.target.value)}
                                          className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                          placeholder="4:30"
                                        />
                                      </td>
                                      <td className="px-4 py-3">
                                        <select
                                          value={setValues?.hyrox_weight_class || firstSet?.hyrox_weight_class || 'open_male'}
                                          onChange={(e) => updateAllExerciseSets(exercise.id, 'hyrox_weight_class', e.target.value)}
                                          className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                        >
                                          <option value="pro_male">Pro M</option>
                                          <option value="pro_female">Pro F</option>
                                          <option value="open_male">Open M</option>
                                          <option value="open_female">Open F</option>
                                          <option value="doubles_male">Dbl M</option>
                                          <option value="doubles_female">Dbl F</option>
                                        </select>
                                      </td>
                                    </tr>
                                  )
                                })}
                                  </tbody>
                                </table>
                              )}
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
                    onClick={handleAssignProgram}
                    disabled={assigning}
                    className="flex items-center gap-2 px-6 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-medium rounded-xl transition-colors"
                  >
                    {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Assign Program
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <Link href="/users" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 mb-6">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-400 mb-6">
          <Check className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Updated successfully!</p>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-6">
          {user.profile_picture_url ? (
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 relative">
              <Image
                src={user.profile_picture_url}
                alt={user.full_name || 'Profile'}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center text-black text-3xl font-bold flex-shrink-0">
              {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {editMode ? (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-2xl font-bold bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Full Name"
                />
              ) : (
                <h1 className="text-2xl font-bold text-white">{user.full_name || 'No name set'}</h1>
              )}
              {user.password_changed ? (
                <span className="badge badge-success">Active</span>
              ) : user.status === 'pending' ? (
                <span className="badge badge-warning flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Pending
                </span>
              ) : (
                <span className="badge badge-info">Invited</span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {editMode ? (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="Email"
                  />
                ) : (
                  <span>{user.email}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
              </div>
              {user.slug && (
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  <span className="text-xs font-mono text-zinc-500">@{user.slug}</span>
                </div>
              )}
            </div>

            {user.temp_password && !user.password_changed && (
              <div className="mt-3 flex items-center gap-2">
                <Key className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-zinc-400">Temp Password:</span>
                <code className="bg-zinc-800 px-2 py-1 rounded text-xs text-yellow-400 font-mono">
                  {user.temp_password}
                </code>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2">
            {editMode ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
                <button
                  onClick={() => { setEditMode(false); setFullName(user.full_name || ''); setEmail(user.email || '') }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <ClientTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <>
          {/* Quick Stats Card */}
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-semibold text-white">Quick Stats</h2>
            </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{clientPrograms.length}</p>
            <p className="text-sm text-zinc-400">Total Programs</p>
          </div>
          <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{clientPrograms.filter(p => p.is_active).length}</p>
            <p className="text-sm text-zinc-400">Active</p>
          </div>
          <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))}
            </p>
            <p className="text-sm text-zinc-400">Days as Client</p>
          </div>
          <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{Object.values(permissions).filter(Boolean).length}</p>
            <p className="text-sm text-zinc-400">Access Types</p>
          </div>
        </div>
      </div>

      {/* Program Access */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Program Access</h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {permissionOptions.map((opt) => {
            const Icon = opt.icon
            const isEnabled = permissions[opt.key as keyof typeof permissions]
            return (
              <button
                key={opt.key}
                onClick={async () => {
                  const newPermissions = { ...permissions, [opt.key]: !isEnabled }
                  setPermissions(newPermissions)
                  // Save immediately
                  try {
                    const response = await fetch(`/api/users/${user.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ permissions: newPermissions })
                    })
                    if (!response.ok) throw new Error('Failed to update')
                    setSuccess(true)
                    setTimeout(() => setSuccess(false), 2000)
                  } catch (err) {
                    console.error('Failed to update permissions:', err)
                    setPermissions(permissions) // Revert on error
                    setError('Failed to update permissions')
                  }
                }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isEnabled
                    ? `${opt.bg} border-current ${opt.color}`
                    : 'bg-zinc-800/30 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <div className="text-left flex-1">
                  <p className={`text-sm font-medium ${isEnabled ? 'text-white' : 'text-zinc-400'}`}>
                    {opt.name}
                  </p>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center ${
                  isEnabled ? 'bg-green-500 justify-end' : 'bg-zinc-700 justify-start'
                }`}>
                  <div className="w-5 h-5 bg-white rounded-full mx-0.5 shadow" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Client Info - Goals, Presenting Condition, Medical History */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <UserIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Client Information</h2>
          </div>
          {editingClientInfo ? (
            <div className="flex gap-2">
              <button
                onClick={saveClientInfo}
                disabled={savingClientInfo}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {savingClientInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
              <button
                onClick={() => {
                  setEditingClientInfo(false)
                  setClientGoals(user?.goals || '')
                  setClientPresentingCondition(user?.presenting_condition || '')
                  setClientMedicalHistory(user?.medical_history || '')
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingClientInfo(true)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* Goals */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Goals</label>
            {editingClientInfo ? (
              <textarea
                value={clientGoals}
                onChange={(e) => setClientGoals(e.target.value)}
                placeholder="What are the client's fitness goals?"
                rows={3}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
              />
            ) : (
              <p className="text-white bg-zinc-800/50 rounded-xl p-4 min-h-[60px]">
                {user?.goals || <span className="text-zinc-500">No goals set</span>}
              </p>
            )}
          </div>

          {/* Presenting Condition */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Presenting Condition</label>
            {editingClientInfo ? (
              <textarea
                value={clientPresentingCondition}
                onChange={(e) => setClientPresentingCondition(e.target.value)}
                placeholder="Current physical condition, injuries, limitations..."
                rows={3}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
              />
            ) : (
              <p className="text-white bg-zinc-800/50 rounded-xl p-4 min-h-[60px]">
                {user?.presenting_condition || <span className="text-zinc-500">No presenting condition recorded</span>}
              </p>
            )}
          </div>

          {/* Medical History */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Medical History</label>
            {editingClientInfo ? (
              <textarea
                value={clientMedicalHistory}
                onChange={(e) => setClientMedicalHistory(e.target.value)}
                placeholder="Relevant medical history, surgeries, conditions..."
                rows={3}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
              />
            ) : (
              <p className="text-white bg-zinc-800/50 rounded-xl p-4 min-h-[60px]">
                {user?.medical_history || <span className="text-zinc-500">No medical history recorded</span>}
              </p>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {/* PROGRAMS TAB */}
      {activeTab === 'programs' && (
        <>
          {/* Assigned Programs */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Dumbbell className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Assigned Programs</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCloneModal}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
            >
              <UserIcon className="w-4 h-4" />
              Clone from User
            </button>
            <button
              onClick={openAssignModal}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Assign Program
            </button>
          </div>
        </div>
        
        {clientPrograms.length > 0 ? (
          <div className="space-y-3">
            {clientPrograms.map((cp) => {
              const Icon = getCategoryIcon(cp.program?.category)
              return (
                <div
                  key={cp.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    cp.is_active ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-zinc-800/30 border-zinc-800'
                  }`}
                >
                  {/* Clickable area - links to program */}
                  <Link 
                    href={`/programs/${cp.program_id}`}
                    className="flex items-center gap-4 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCategoryColor(cp.program?.category)}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-white">{cp.program?.name || 'Unknown Program'}</p>
                        {cp.is_active && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-400/20 text-yellow-400 rounded-full">Active</span>
                        )}
                      </div>
                      {cp.phase_name && (
                        <p className="text-sm text-yellow-400/80 mb-1">{cp.phase_name}</p>
                      )}
                      <div className="flex items-center gap-3 text-sm text-zinc-400">
                        <span className={`px-2 py-0.5 rounded text-xs ${getDifficultyColor(cp.program?.difficulty)}`}>
                          {cp.program?.difficulty || 'Unknown'}
                        </span>
                        <span>{cp.duration_weeks} weeks</span>
                        <span>•</span>
                        <span>Started {new Date(cp.start_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Link>

                  <div className="text-right text-sm">
                    {cp.end_date && (
                      <>
                        <p className="text-zinc-400">Ends</p>
                        <p className="text-white">{new Date(cp.end_date).toLocaleDateString()}</p>
                      </>
                    )}
                  </div>
                  
                  {/* Unassign button */}
                  <button
                    onClick={async () => {
                      if (!confirm('Unassign this program from the user?')) return
                      try {
                        await supabase.from('client_programs').delete().eq('id', cp.id)
                        // Also delete any custom sets
                        await supabase.from('client_exercise_sets').delete().eq('client_program_id', cp.id)
                        fetchClientPrograms(user.id)
                        setSuccess(true)
                        setTimeout(() => setSuccess(false), 3000)
                      } catch (err) {
                        console.error('Failed to unassign program:', err)
                        setError('Failed to unassign program')
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Unassign program"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
              <Dumbbell className="w-7 h-7 text-zinc-600" />
            </div>
            <p className="text-zinc-400 mb-4">No programs assigned yet</p>
            <button
              onClick={openAssignModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Assign First Program
            </button>
          </div>
        )}

      </div>
        </>
      )}

      {/* PROGRESS TAB */}
      {activeTab === 'progress' && user && (
        <ProgressTab clientId={user.id} clientName={user.full_name || user.email || 'Client'} />
      )}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && user && (
        <ProfileTab clientId={user.id} />
      )}

      {/* NUTRITION TAB */}
      {activeTab === 'nutrition' && (
        <>
          {/* Nutrition Plan */}
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Apple className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Nutrition Plan</h2>
          </div>
          {!clientNutrition && (
            <button
              onClick={() => {
                fetchAvailableNutritionPlans()
                setShowNutritionModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Assign Plan
            </button>
          )}
        </div>
        
        {/* Client Self-Created Plan */}
        {clientSelfNutrition && (
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">Created by client</span>
                </div>
                <p className="text-2xl font-bold text-purple-400">{clientSelfNutrition.calories} cal</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-blue-400 font-bold">{clientSelfNutrition.protein}g</p>
                <p className="text-zinc-500 text-xs">Protein</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-yellow-400 font-bold">{clientSelfNutrition.carbs}g</p>
                <p className="text-zinc-500 text-xs">Carbs</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-red-400 font-bold">{clientSelfNutrition.fats}g</p>
                <p className="text-zinc-500 text-xs">Fats</p>
              </div>
            </div>
          </div>
        )}

        {/* Trainer-Assigned Plan */}
        {clientNutrition ? (
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Assigned by trainer</span>
                  <span className="text-zinc-400 text-sm">{clientNutrition.plan_name}</span>
                </div>
                <p className="text-2xl font-bold text-green-400">{clientNutrition.calories} cal</p>
              </div>
              <button
                onClick={removeNutritionPlan}
                className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                title="Remove plan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-blue-400 font-bold">{clientNutrition.protein}g</p>
                <p className="text-zinc-500 text-xs">Protein</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-yellow-400 font-bold">{clientNutrition.carbs}g</p>
                <p className="text-zinc-500 text-xs">Carbs</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-red-400 font-bold">{clientNutrition.fats}g</p>
                <p className="text-zinc-500 text-xs">Fats</p>
              </div>
            </div>
            
            {clientNutrition.notes && (
              <p className="text-zinc-400 text-sm mt-3">{clientNutrition.notes}</p>
            )}
          </div>
        ) : !clientSelfNutrition ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
              <Apple className="w-7 h-7 text-zinc-600" />
            </div>
            <p className="text-zinc-400 mb-4">No nutrition plan assigned</p>
            <button
              onClick={() => {
                fetchAvailableNutritionPlans()
                setShowNutritionModal(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Assign Nutrition Plan
            </button>
          </div>
        ) : null}
      </div>

      {/* Nutrition Assignment Modal */}
      {showNutritionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h3 className="text-xl font-semibold text-white">Assign Nutrition Plan</h3>
              <button onClick={() => { setShowNutritionModal(false); setCustomNutritionMode(false) }} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            {/* Mode Toggle */}
            <div className="flex gap-2 p-4 border-b border-zinc-800">
              <button
                onClick={() => { setCustomNutritionMode(false); setSelectedNutritionPlan(null) }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  !customNutritionMode
                    ? 'bg-green-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                From Template
              </button>
              <button
                onClick={() => { setCustomNutritionMode(true); setSelectedNutritionPlan(null) }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  customNutritionMode
                    ? 'bg-green-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Custom Plan
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {!customNutritionMode ? (
                /* Template Selection */
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Select Plan</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableNutritionPlans.map(plan => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedNutritionPlan(plan.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedNutritionPlan === plan.id
                            ? 'border-green-400 bg-green-400/10'
                            : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <Apple className="w-5 h-5 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white">{plan.name}</p>
                          <p className="text-xs text-zinc-400">
                            {plan.calories} cal • P:{plan.protein}g • C:{plan.carbs}g • F:{plan.fats}g
                          </p>
                        </div>
                        {selectedNutritionPlan === plan.id && (
                          <Check className="w-5 h-5 text-green-400" />
                        )}
                      </div>
                    ))}
                    {availableNutritionPlans.length === 0 && (
                      <p className="text-zinc-500 text-center py-4">No nutrition plans available. Create one first.</p>
                    )}
                  </div>
                </div>
              ) : (
                /* Custom Plan with Calculator */
                <div className="space-y-4">
                  <BMRCalculator
                    onApply={(result) => {
                      setCustomCalories(result.tdee)
                      setCustomProtein(result.protein)
                      setCustomCarbs(result.carbs)
                      setCustomFats(result.fats)
                    }}
                  />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Calories</label>
                      <input
                        type="number"
                        value={customCalories}
                        onChange={(e) => setCustomCalories(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Protein (g)</label>
                      <input
                        type="number"
                        value={customProtein}
                        onChange={(e) => setCustomProtein(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Carbs (g)</label>
                      <input
                        type="number"
                        value={customCarbs}
                        onChange={(e) => setCustomCarbs(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Fats (g)</label>
                      <input
                        type="number"
                        value={customFats}
                        onChange={(e) => setCustomFats(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Notes <span className="text-zinc-600">(optional)</span>
                </label>
                <textarea
                  value={nutritionNotes}
                  onChange={(e) => setNutritionNotes(e.target.value)}
                  placeholder="Any special instructions for this client..."
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-zinc-800">
              <button
                onClick={() => { setShowNutritionModal(false); setCustomNutritionMode(false) }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={assignNutritionPlan}
                disabled={(!customNutritionMode && !selectedNutritionPlan) || assigningNutrition}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white font-medium rounded-xl transition-colors"
              >
                {assigningNutrition ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Assign Plan
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* SCHEDULE TAB */}
      {activeTab === 'schedule' && user && (
        <UserSchedule userId={user.id} />
      )}

      {/* Workout History - HIDDEN (now in Progress tab) */}
      {false && <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-400" />
            Workout History
          </h2>
          <span className="text-sm text-zinc-500">{workoutHistory.length} recent workouts</span>
        </div>

        {workoutHistory.length > 0 ? (
          <div className="space-y-2">
            {workoutHistory.map((workout) => (
              <div key={workout.id} className="bg-zinc-800/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedWorkoutLog(expandedWorkoutLog === workout.id ? null : workout.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-white text-sm">{workout.workoutName}</p>
                      <p className="text-xs text-zinc-500">{workout.programName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-white text-xs font-medium">{workout.totalSets} sets</p>
                      <p className="text-zinc-500 text-[10px]">
                        {new Date(workout.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    {expandedWorkoutLog === workout.id ? (
                      <ChevronUp className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                </button>
                
                {expandedWorkoutLog === workout.id && workout.exercises.length > 0 && (
                  <div className="border-t border-zinc-700/50 bg-zinc-900/50">
                    {workout.exercises.map((exercise, idx) => (
                      <div key={idx} className="px-4 py-2 border-t border-zinc-800/50 first:border-t-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-xs font-medium">{exercise.name}</span>
                          <span className="text-zinc-500 text-[10px]">{exercise.sets.length} sets</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {exercise.sets.map((set, setIdx) => (
                            <span 
                              key={setIdx}
                              className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-300"
                            >
                              {set.weight}kg × {set.reps}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-7 h-7 text-zinc-600" />
            </div>
            <p className="text-zinc-400">No workout history yet</p>
            <p className="text-zinc-500 text-sm mt-1">Completed workouts will appear here</p>
          </div>
        )}
      </div>}

      {/* Danger Zone - Always visible */}
      <div className="card p-6 border-red-500/20 mt-6">
        <h2 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Deleting this user will remove their account and move them to the inactive list in Klaviyo.
          This action cannot be undone.
        </p>
        
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete User
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Confirm Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
