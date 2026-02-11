import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import PageHeader from '../components/PageHeader'
import Link from 'next/link'
import { Calculator, User, UserCheck } from 'lucide-react'

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'

export default async function NutritionPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile to check nutrition access
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, can_access_nutrition')
    .eq('id', user.id)
    .single()

  // Check if user has nutrition access
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

  // Get trainer-assigned nutrition plan
  const { data: trainerPlan } = await supabase
    .from('client_nutrition')
    .select(`
      *,
      nutrition_plans (*)
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)
    .eq('created_by_type', 'trainer')
    .single()

  // Get client-created nutrition plan
  const { data: clientPlan } = await supabase
    .from('client_nutrition')
    .select('*')
    .eq('client_id', user.id)
    .eq('is_active', true)
    .eq('created_by_type', 'client')
    .single()

  // Process trainer plan
  const trainerNutrition = trainerPlan ? {
    calories: trainerPlan.custom_calories || trainerPlan.nutrition_plans?.calories || 0,
    protein: trainerPlan.custom_protein || trainerPlan.nutrition_plans?.protein || 0,
    carbs: trainerPlan.custom_carbs || trainerPlan.nutrition_plans?.carbs || 0,
    fats: trainerPlan.custom_fats || trainerPlan.nutrition_plans?.fats || 0,
    planName: trainerPlan.nutrition_plans?.name || 'Coach Plan',
    notes: trainerPlan.notes
  } : null

  // Process client plan
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
          <Link 
            href="/nutrition/calculator"
            className="p-2 bg-yellow-400/10 rounded-lg hover:bg-yellow-400/20 transition-colors"
          >
            <Calculator className="w-5 h-5 text-yellow-400" />
          </Link>
        }
      />

      <main className="px-6 py-6 space-y-6">
        {/* Client's Own Plan */}
        {clientNutrition && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-green-400" />
                My Plan
              </h2>
              <Link 
                href="/nutrition/calculator"
                className="text-yellow-400 text-sm hover:underline"
              >
                Edit
              </Link>
            </div>
            
            <div className="bg-zinc-900 border border-green-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                  Created by you
                </span>
              </div>

              {/* Calories */}
              <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Calories</span>
                  <span className="text-2xl font-bold text-white">{clientNutrition.calories}</span>
                </div>
              </div>

              {/* Macros Grid */}
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

        {/* Trainer-Assigned Plan */}
        {trainerNutrition && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-400" />
              Coach Plan
            </h2>
            
            <div className="bg-zinc-900 border border-blue-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                  Assigned by coach
                </span>
                {trainerNutrition.planName && (
                  <span className="text-zinc-500 text-sm">{trainerNutrition.planName}</span>
                )}
              </div>

              {/* Calories */}
              <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Calories</span>
                  <span className="text-2xl font-bold text-white">{trainerNutrition.calories}</span>
                </div>
              </div>

              {/* Macros Grid */}
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

              {/* Notes from coach */}
              {trainerNutrition.notes && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <p className="text-sm text-zinc-400 mb-2">Coach Notes</p>
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap">{trainerNutrition.notes}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* No Plans - Show Calculator CTA */}
        {!hasAnyPlan && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calculator className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No Nutrition Plan Yet</h2>
            <p className="text-zinc-400 mb-6">Calculate your own macros or wait for your coach to assign a plan.</p>
            <Link
              href="/nutrition/calculator"
              className="inline-flex items-center gap-2 bg-yellow-400 text-black px-6 py-3 rounded-xl font-semibold"
            >
              <Calculator className="w-5 h-5" />
              Create My Plan
            </Link>
          </div>
        )}

        {/* Create Plan Button (when has trainer plan but no client plan) */}
        {trainerNutrition && !clientNutrition && (
          <Link
            href="/nutrition/calculator"
            className="block bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center hover:border-yellow-400/30 transition-colors"
          >
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
