/**
 * Shared types for the eddytrains app
 * 
 * These match the database schema and should be kept in sync.
 * If we ever add a monorepo, these would move to @eddytrains/types
 */

export interface Profile {
  id: string
  slug: string | null
  email: string | null
  full_name: string | null
  role: 'admin' | 'user'
  is_active: boolean
  status: 'pending' | 'active' | null
  temp_password: string | null
  password_changed: boolean
  must_change_password: boolean
  profile_picture_url: string | null
  // Permissions (embedded in profile for simplicity)
  can_access_strength: boolean
  can_access_cardio: boolean
  can_access_hyrox: boolean
  can_access_hybrid: boolean
  can_access_nutrition: boolean
  // Timestamps
  created_at: string
  updated_at: string
}

export interface Client1RM {
  id: string
  client_id: string
  exercise_name: string
  weight_kg: number
  created_at: string
  updated_at: string
}

export interface ProgressImage {
  id: string
  client_id: string
  image_url: string
  notes: string | null
  created_at: string
}

export interface Program {
  id: string
  name: string
  description: string | null
  category: 'strength' | 'cardio' | 'hyrox' | 'hybrid'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClientProgram {
  id: string
  client_id: string
  program_id: string
  start_date: string
  end_date: string | null
  duration_weeks: number
  phase_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  program?: Program
}

export interface ProgramWorkout {
  id: string
  program_id: string
  name: string
  day_of_week: number | null
  order_index: number
  created_at: string
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  exercise_name: string
  order_index: number
  // Joined
  exercise_sets?: ExerciseSet[]
}

export interface ExerciseSet {
  id: string
  workout_exercise_id: string
  set_number: number
  reps: string
  intensity_type: 'rir' | 'rpe' | 'percentage'
  intensity_value: string
  rest_bracket: string | null
  rest_seconds: number | null
  weight_type: string | null
  notes: string | null
}

export interface ClientExerciseSet {
  id: string
  client_program_id: string
  workout_exercise_id: string
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket: string | null
  weight_type: string | null
  notes: string | null
}

export interface WorkoutCompletion {
  id: string
  client_id: string
  workout_id: string
  client_program_id: string | null
  completed_at: string
  notes: string | null
}

export interface NutritionPlan {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  description: string | null
  is_active: boolean
}

export interface ClientNutrition {
  id: string
  client_id: string
  plan_id: string
  custom_calories: number | null
  custom_protein: number | null
  custom_carbs: number | null
  custom_fats: number | null
  notes: string | null
  is_active: boolean
  // Joined
  nutrition_plans?: NutritionPlan
}
