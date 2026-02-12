/**
 * Shared types for the eddytrains app
 * 
 * These match the database schema and should be kept in sync.
 * If we ever add a monorepo, these would move to @eddytrains/types
 */

// =============================================
// ORGANIZATION TYPES (Multi-tenant)
// =============================================

export type OrgMemberRole = 'owner' | 'admin' | 'trainer'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  // Billing
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing'
  // Custom limits
  max_trainers: number
  max_clients: number
  // Settings
  settings: Record<string, unknown>
  is_active: boolean
  // Timestamps
  created_at: string
  updated_at: string
  // Joined
  members?: OrganizationMember[]
  member_count?: number
  client_count?: number
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: OrgMemberRole
  invited_by: string | null
  invited_at: string | null
  joined_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  profile?: Profile
  organization?: Organization
}

export interface OrganizationInvite {
  id: string
  organization_id: string
  email: string
  role: OrgMemberRole
  invited_by: string | null
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
  // Joined
  organization?: Organization
  inviter?: Profile
}

export interface TrainerClient {
  id: string
  trainer_id: string
  client_id: string
  organization_id: string
  is_active: boolean
  assigned_at: string
  created_at: string
  updated_at: string
  // Joined
  trainer?: Profile
  client?: Profile
  organization?: Organization
}

// =============================================
// USER TYPES
// =============================================

export interface Profile {
  id: string
  slug: string | null
  email: string | null
  full_name: string | null
  role: 'super_admin' | 'admin' | 'trainer' | 'client' | 'user'
  is_super_admin: boolean
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
  // Joined
  organization_member?: OrganizationMember
}

// =============================================
// FITNESS TYPES
// =============================================

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
  intensity_type: 'rir' | 'rpe' | 'percentage' | 'time' | 'failure'
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

export interface AdminNotification {
  id: string
  client_id: string
  type: 'missed_workout' | 'new_pr' | 'streak_achieved' | 'streak_lost' | 'milestone'
  title: string
  message: string
  metadata: Record<string, unknown>
  is_read: boolean
  is_dismissed: boolean
  created_at: string
  updated_at: string
  // Joined
  profiles?: Profile
}

export interface ClientStreak {
  id: string
  client_id: string
  current_streak: number
  longest_streak: number
  last_workout_date: string | null
  streak_start_date: string | null
  updated_at: string
  // Joined
  profiles?: Profile
}

export interface PersonalRecord {
  id: string
  client_id: string
  exercise_name: string
  weight_kg: number
  reps: number
  estimated_1rm: number | null
  achieved_at: string
  // Joined
  profiles?: Profile
}

// =============================================
// PLATFORM STATS (Super Admin Dashboard)
// =============================================

export interface PlatformStats {
  total_organizations: number
  total_trainers: number
  total_clients: number
  active_subscriptions: number
  mrr: number // Monthly Recurring Revenue
  organizations_by_status: Record<string, number>
}
