import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import Link from 'next/link'

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
        <header className="bg-zinc-900 border-b border-zinc-800">
          <div className="px-6 py-6">
            <h1 className="text-2xl font-bold text-white">Nutrition</h1>
          </div>
        </header>

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

  // Get user's nutrition plan
  const { data: clientNutrition } = await supabase
    .from('client_nutrition')
    .select(`
      *,
      nutrition_plans (*)
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)
    .single()

  // Use custom values or fall back to plan defaults
  const nutrition = clientNutrition ? {
    calories: clientNutrition.custom_calories || clientNutrition.nutrition_plans?.calories || 0,
    protein: clientNutrition.custom_protein || clientNutrition.nutrition_plans?.protein || 0,
    carbs: clientNutrition.custom_carbs || clientNutrition.nutrition_plans?.carbs || 0,
    fats: clientNutrition.custom_fats || clientNutrition.nutrition_plans?.fats || 0,
    planName: clientNutrition.nutrition_plans?.name || 'Custom Plan',
    notes: clientNutrition.notes
  } : null

  return (
    <div className="min-h-screen bg-black pb-32">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="px-6 py-6">
          <h1 className="text-2xl font-bold text-white">Nutrition</h1>
          {nutrition && (
            <p className="text-zinc-400 text-sm mt-1">{nutrition.planName}</p>
          )}
        </div>
      </header>

      <main className="px-6 py-6 space-y-6">
        {nutrition ? (
          <>
            {/* Daily Targets */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Daily Targets</h2>
              
              {/* Calories */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Calories</span>
                  <span className="text-2xl font-bold text-white">{nutrition.calories}</span>
                </div>
                <div className="mt-3 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: '0%' }}></div>
                </div>
              </div>

              {/* Macros Grid */}
              <div className="grid grid-cols-3 gap-3">
                {/* Protein */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-blue-400 font-bold text-sm">P</span>
                  </div>
                  <div className="text-xl font-bold text-white">{nutrition.protein}g</div>
                  <p className="text-zinc-500 text-xs mt-1">Protein</p>
                </div>

                {/* Carbs */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-yellow-400 font-bold text-sm">C</span>
                  </div>
                  <div className="text-xl font-bold text-white">{nutrition.carbs}g</div>
                  <p className="text-zinc-500 text-xs mt-1">Carbs</p>
                </div>

                {/* Fats */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-red-400 font-bold text-sm">F</span>
                  </div>
                  <div className="text-xl font-bold text-white">{nutrition.fats}g</div>
                  <p className="text-zinc-500 text-xs mt-1">Fats</p>
                </div>
              </div>
            </section>

            {/* Notes from coach */}
            {nutrition.notes && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">Coach Notes</h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-zinc-300 whitespace-pre-wrap">{nutrition.notes}</p>
                </div>
              </section>
            )}

            {/* Macro Breakdown */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Macro Breakdown</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-blue-400">Protein</span>
                      <span className="text-zinc-400">{Math.round((nutrition.protein * 4 / nutrition.calories) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-400 rounded-full" 
                        style={{ width: `${Math.round((nutrition.protein * 4 / nutrition.calories) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-yellow-400">Carbs</span>
                      <span className="text-zinc-400">{Math.round((nutrition.carbs * 4 / nutrition.calories) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-400 rounded-full" 
                        style={{ width: `${Math.round((nutrition.carbs * 4 / nutrition.calories) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-red-400">Fats</span>
                      <span className="text-zinc-400">{Math.round((nutrition.fats * 9 / nutrition.calories) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-400 rounded-full" 
                        style={{ width: `${Math.round((nutrition.fats * 9 / nutrition.calories) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No Nutrition Plan</h2>
            <p className="text-zinc-400">Your coach hasn&apos;t set up a nutrition plan yet.</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
