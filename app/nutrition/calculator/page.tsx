'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import BottomNav from '../../components/BottomNav'
import { ArrowLeft, Calculator, Save } from 'lucide-react'
import Link from 'next/link'

interface CalcData {
  height_cm: number
  weight_kg: number
  age: number
  gender: 'male' | 'female'
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  goal: 'lose' | 'maintain' | 'gain'
}

interface Macros {
  calories: number
  protein: number
  carbs: number
  fats: number
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const GOAL_ADJUSTMENTS = {
  lose: -500,
  maintain: 0,
  gain: 500,
}

function calculateMacros(data: CalcData): Macros {
  // Mifflin-St Jeor equation for BMR
  let bmr: number
  if (data.gender === 'male') {
    bmr = 10 * data.weight_kg + 6.25 * data.height_cm - 5 * data.age + 5
  } else {
    bmr = 10 * data.weight_kg + 6.25 * data.height_cm - 5 * data.age - 161
  }

  // Apply activity multiplier
  const tdee = bmr * ACTIVITY_MULTIPLIERS[data.activity_level]

  // Apply goal adjustment
  const calories = Math.round(tdee + GOAL_ADJUSTMENTS[data.goal])

  // Calculate macros (protein: 2g/kg, fats: 25%, rest carbs)
  const protein = Math.round(data.weight_kg * 2)
  const proteinCals = protein * 4
  const fatCals = calories * 0.25
  const fats = Math.round(fatCals / 9)
  const carbCals = calories - proteinCals - fatCals
  const carbs = Math.round(carbCals / 4)

  return { calories, protein, carbs, fats }
}

export default function NutritionCalculatorPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existingPlan, setExistingPlan] = useState<any>(null)
  const [calcData, setCalcData] = useState<CalcData>({
    height_cm: 175,
    weight_kg: 75,
    age: 30,
    gender: 'male',
    activity_level: 'moderate',
    goal: 'maintain',
  })
  const [macros, setMacros] = useState<Macros | null>(null)

  useEffect(() => {
    checkAccess()
  }, [])

  useEffect(() => {
    // Recalculate macros when inputs change
    const newMacros = calculateMacros(calcData)
    setMacros(newMacros)
  }, [calcData])

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Check nutrition access
    const { data: profile } = await supabase
      .from('profiles')
      .select('can_access_nutrition')
      .eq('id', user.id)
      .single()

    if (!profile?.can_access_nutrition) {
      router.push('/nutrition')
      return
    }

    // Check for existing client-created plan
    const { data: existing } = await supabase
      .from('client_nutrition')
      .select('*')
      .eq('client_id', user.id)
      .eq('created_by_type', 'client')
      .single()

    if (existing) {
      setExistingPlan(existing)
      // Pre-fill with existing values
      setCalcData({
        height_cm: existing.calc_height_cm || 175,
        weight_kg: existing.calc_weight_kg || 75,
        age: existing.calc_age || 30,
        gender: existing.calc_gender || 'male',
        activity_level: existing.calc_activity_level || 'moderate',
        goal: existing.calc_goal || 'maintain',
      })
    }

    setLoading(false)
  }

  async function savePlan() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !macros) return

    const planData = {
      client_id: user.id,
      custom_calories: macros.calories,
      custom_protein: macros.protein,
      custom_carbs: macros.carbs,
      custom_fats: macros.fats,
      calc_height_cm: calcData.height_cm,
      calc_weight_kg: calcData.weight_kg,
      calc_age: calcData.age,
      calc_gender: calcData.gender,
      calc_activity_level: calcData.activity_level,
      calc_goal: calcData.goal,
      created_by_type: 'client',
      created_by_id: user.id,
      is_active: true,
    }

    if (existingPlan) {
      // Update existing
      await supabase
        .from('client_nutrition')
        .update(planData)
        .eq('id', existingPlan.id)
    } else {
      // Create new
      await supabase
        .from('client_nutrition')
        .insert(planData)
    }

    setSaving(false)
    router.push('/nutrition')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-32">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="px-6 py-4 flex items-center gap-4">
          <Link href="/nutrition" className="p-2 -ml-2 hover:bg-zinc-800 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Nutrition Calculator</h1>
            <p className="text-zinc-400 text-sm">
              {existingPlan ? 'Edit your plan' : 'Create your nutrition plan'}
            </p>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6">
        {/* Input Fields */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-yellow-400" />
            Your Details
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Height (cm)</label>
              <input
                type="number"
                value={calcData.height_cm}
                onChange={(e) => setCalcData({ ...calcData, height_cm: Number(e.target.value) })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Weight (kg)</label>
              <input
                type="number"
                value={calcData.weight_kg}
                onChange={(e) => setCalcData({ ...calcData, weight_kg: Number(e.target.value) })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Age</label>
              <input
                type="number"
                value={calcData.age}
                onChange={(e) => setCalcData({ ...calcData, age: Number(e.target.value) })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Gender</label>
              <select
                value={calcData.gender}
                onChange={(e) => setCalcData({ ...calcData, gender: e.target.value as 'male' | 'female' })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Activity Level</label>
            <select
              value={calcData.activity_level}
              onChange={(e) => setCalcData({ ...calcData, activity_level: e.target.value as CalcData['activity_level'] })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white"
            >
              <option value="sedentary">Sedentary (little/no exercise)</option>
              <option value="light">Light (1-3 days/week)</option>
              <option value="moderate">Moderate (3-5 days/week)</option>
              <option value="active">Active (6-7 days/week)</option>
              <option value="very_active">Very Active (2x per day)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Goal</label>
            <div className="grid grid-cols-3 gap-2">
              {(['lose', 'maintain', 'gain'] as const).map((goal) => (
                <button
                  key={goal}
                  onClick={() => setCalcData({ ...calcData, goal })}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-colors ${
                    calcData.goal === goal
                      ? 'bg-yellow-400 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {goal === 'lose' ? 'Lose Fat' : goal === 'maintain' ? 'Maintain' : 'Build Muscle'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Calculated Results */}
        {macros && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">Your Daily Targets</h2>

            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-4 mb-4">
              <p className="text-yellow-400 text-sm">Calories</p>
              <p className="text-3xl font-bold text-white">{macros.calories}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                <p className="text-blue-400 text-xs">Protein</p>
                <p className="text-xl font-bold text-white">{macros.protein}g</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
                <p className="text-yellow-400 text-xs">Carbs</p>
                <p className="text-xl font-bold text-white">{macros.carbs}g</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-red-400 text-xs">Fats</p>
                <p className="text-xl font-bold text-white">{macros.fats}g</p>
              </div>
            </div>
          </section>
        )}

        {/* Save Button */}
        <button
          onClick={savePlan}
          disabled={saving}
          className="w-full bg-yellow-400 text-black py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : existingPlan ? 'Update My Plan' : 'Save My Plan'}
        </button>
      </main>

      <BottomNav />
    </div>
  )
}
