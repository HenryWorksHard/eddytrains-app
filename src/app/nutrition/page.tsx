import { createClient } from '../lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import PageHeader from '../components/PageHeader'
import Link from 'next/link'
import { Calculator, User, UserCheck, Users } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import TrainerNutritionView from './TrainerNutritionView'

export const revalidate = 0 // Disable caching for debugging

// Admin client for bypassing RLS if needed
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function NutritionPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile with role - use admin client to bypass RLS
  const adminClient = getAdminClient()
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, can_access_nutrition, organization_id')
    .eq('id', user.id)
    .single()

  console.log('[Nutrition] Profile query:', { 
    userId: user.id, 
    userEmail: user.email,
    profile: profile,
    error: profileError?.message 
  })

  const role = profile?.role || 'client'
  const isTrainer = ['trainer', 'admin', 'company_admin', 'super_admin'].includes(role)
  
  console.log('[Nutrition] Role detection:', { role, isTrainer })

  // TRAINER VIEW - Show client selector
  if (isTrainer) {
    // Get all clients in the organization using admin client
    const { data: clients } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', profile?.organization_id)
      .eq('role', 'client')
      .order('full_name')

    return (
      <>
        {/* Sidebar handles both desktop (full sidebar) and mobile (hamburger menu) */}
        <Sidebar />
        
        <main className="lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8 pb-8">
          {/* Mobile title - shown below mobile header */}
          <div className="lg:hidden mb-4">
            <h1 className="text-xl font-bold text-white">Nutrition</h1>
            <p className="text-zinc-400 text-sm">View and manage client nutrition plans</p>
          </div>
          
          {/* Desktop header */}
          <div className="hidden lg:block mb-6">
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Nutrition</h1>
            <p className="text-zinc-400 mt-1">View and manage client nutrition plans</p>
          </div>
          
          <TrainerNutritionView clients={clients || []} />
        </main>
      </>
    )
  }

  // CLIENT VIEW - Show their own nutrition
  const [trainerPlanResult, clientPlanResult] = await Promise.all([
    supabase
      .from('client_nutrition')
      .select(`*, nutrition_plans (*)`)
      .eq('client_id', user.id)
      .eq('is_active', true)
      .eq('created_by_type', 'trainer')
      .single(),
    
    supabase
      .from('client_nutrition')
      .select('*')
      .eq('client_id', user.id)
      .eq('is_active', true)
      .eq('created_by_type', 'client')
      .single()
  ])

  const trainerPlan = trainerPlanResult.data
  const clientPlan = clientPlanResult.data

  if (!profile?.can_access_nutrition) {
    return (
      <div className="min-h-screen bg-black pb-32">
        <PageHeader title="Nutrition" />
        <main className="px-6 py-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Nutrition Not Enabled</h2>
            <p className="text-zinc-400">Contact your coach to enable nutrition tracking for your account.</p>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const trainerNutrition = trainerPlan ? {
    calories: trainerPlan.custom_calories || trainerPlan.nutrition_plans?.calories || 0,
    protein: trainerPlan.custom_protein || trainerPlan.nutrition_plans?.protein || 0,
    carbs: trainerPlan.custom_carbs || trainerPlan.nutrition_plans?.carbs || 0,
    fats: trainerPlan.custom_fats || trainerPlan.nutrition_plans?.fats || 0,
    planName: trainerPlan.nutrition_plans?.name || 'Coach Plan',
    notes: trainerPlan.notes
  } : null

  const clientNutrition = clientPlan ? {
    calories: clientPlan.custom_calories || 0,
    protein: clientPlan.custom_protein || 0,
    carbs: clientPlan.custom_carbs || 0,
    fats: clientPlan.custom_fats || 0,
  } : null

  const hasAnyPlan = trainerNutrition || clientNutrition

  return (
    <div className="min-h-screen bg-black pb-32">
      <PageHeader 
        title="Nutrition" 
        rightElement={
          <Link href="/nutrition/calculator" className="p-2 bg-yellow-400/10 rounded-lg hover:bg-yellow-400/20 transition-colors">
            <Calculator className="w-5 h-5 text-yellow-400" />
          </Link>
        }
      />

      <main className="px-6 py-6 space-y-6">
        {clientNutrition && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-green-400" />
                My Plan
              </h2>
              <Link href="/nutrition/calculator" className="text-yellow-400 text-sm hover:underline">Edit</Link>
            </div>
            
            <div className="bg-zinc-900 border border-green-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Created by you</span>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Calories</span>
                  <span className="text-2xl font-bold text-white">{clientNutrition.calories}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{clientNutrition.protein}g</div>
                  <p className="text-blue-400 text-xs">Protein</p>
                </div>
                <div className="bg-yellow-500/10 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{clientNutrition.carbs}g</div>
                  <p className="text-yellow-400 text-xs">Carbs</p>
                </div>
                <div className="bg-red-500/10 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{clientNutrition.fats}g</div>
                  <p className="text-red-400 text-xs">Fats</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {trainerNutrition && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-400" />
              Coach Plan
            </h2>
            
            <div className="bg-zinc-900 border border-blue-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">Assigned by coach</span>
                {trainerNutrition.planName && <span className="text-zinc-500 text-sm">{trainerNutrition.planName}</span>}
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Calories</span>
                  <span className="text-2xl font-bold text-white">{trainerNutrition.calories}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{trainerNutrition.protein}g</div>
                  <p className="text-blue-400 text-xs">Protein</p>
                </div>
                <div className="bg-yellow-500/10 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{trainerNutrition.carbs}g</div>
                  <p className="text-yellow-400 text-xs">Carbs</p>
                </div>
                <div className="bg-red-500/10 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-white">{trainerNutrition.fats}g</div>
                  <p className="text-red-400 text-xs">Fats</p>
                </div>
              </div>
              {trainerNutrition.notes && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <p className="text-sm text-zinc-400 mb-2">Coach Notes</p>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{trainerNutrition.notes}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {!hasAnyPlan && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calculator className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No Nutrition Plan Yet</h2>
            <p className="text-zinc-400 mb-6">Calculate your own macros or wait for your coach to assign a plan.</p>
            <Link href="/nutrition/calculator" className="inline-flex items-center gap-2 bg-yellow-400 text-black px-6 py-3 rounded-xl font-semibold">
              <Calculator className="w-5 h-5" />
              Create My Plan
            </Link>
          </div>
        )}

        {trainerNutrition && !clientNutrition && (
          <Link href="/nutrition/calculator" className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center hover:border-yellow-400/30 transition-colors">
            <div className="flex items-center justify-center gap-3">
              <Calculator className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-medium">Create My Own Plan</span>
            </div>
            <p className="text-zinc-500 text-sm mt-2">Calculate macros based on your goals</p>
          </Link>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
