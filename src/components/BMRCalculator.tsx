'use client'

import { useState } from 'react'
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react'

interface BMRResult {
  bmr: number
  tdee: number
  protein: number
  carbs: number
  fats: number
}

const activityLevels = [
  { value: 1.2, label: 'Sedentary', desc: 'Little or no exercise' },
  { value: 1.375, label: 'Light', desc: 'Light exercise 1-3 days/week' },
  { value: 1.55, label: 'Moderate', desc: 'Moderate exercise 3-5 days/week' },
  { value: 1.725, label: 'Active', desc: 'Hard exercise 6-7 days/week' },
  { value: 1.9, label: 'Very Active', desc: 'Very hard exercise, physical job' },
]

const goals = [
  { value: -500, label: 'Fat Loss', desc: '-500 cal deficit' },
  { value: -250, label: 'Slow Cut', desc: '-250 cal deficit' },
  { value: 0, label: 'Maintenance', desc: 'Maintain weight' },
  { value: 250, label: 'Lean Bulk', desc: '+250 cal surplus' },
  { value: 500, label: 'Bulk', desc: '+500 cal surplus' },
]

interface Props {
  onApply?: (result: BMRResult) => void
}

export default function BMRCalculator({ onApply }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [age, setAge] = useState(25)
  const [weight, setWeight] = useState(75) // kg
  const [height, setHeight] = useState(175) // cm
  const [activityLevel, setActivityLevel] = useState(1.55)
  const [goal, setGoal] = useState(0)
  const [proteinMultiplier, setProteinMultiplier] = useState(2.0) // g per kg
  const [result, setResult] = useState<BMRResult | null>(null)

  const calculate = () => {
    // Mifflin-St Jeor Equation
    let bmr: number
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161
    }

    const tdee = Math.round(bmr * activityLevel + goal)
    const protein = Math.round(weight * proteinMultiplier)
    const proteinCals = protein * 4
    
    // Remaining calories split: 25% fat, rest carbs
    const fatCals = Math.round((tdee - proteinCals) * 0.25)
    const fats = Math.round(fatCals / 9)
    const carbsCals = tdee - proteinCals - fatCals
    const carbs = Math.round(carbsCals / 4)

    const calculatedResult = {
      bmr: Math.round(bmr),
      tdee,
      protein,
      carbs,
      fats,
    }
    
    setResult(calculatedResult)
  }

  const handleApply = () => {
    if (result && onApply) {
      onApply(result)
      setExpanded(false)
    }
  }

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-yellow-400" />
          <span className="font-medium text-white">BMR/TDEE Calculator</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-zinc-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-400" />
        )}
      </button>

      {expanded && (
        <div className="p-4 border-t border-zinc-700 space-y-4">
          {/* Gender */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Gender</label>
            <div className="flex gap-2">
              <button
                onClick={() => setGender('male')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  gender === 'male'
                    ? 'bg-yellow-400 text-black'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                Male
              </button>
              <button
                onClick={() => setGender('female')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  gender === 'female'
                    ? 'bg-yellow-400 text-black'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                Female
              </button>
            </div>
          </div>

          {/* Age, Weight, Height */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Weight (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Height (cm)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-yellow-400"
              />
            </div>
          </div>

          {/* Activity Level */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Activity Level</label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-yellow-400"
            >
              {activityLevels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} — {level.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-yellow-400"
            >
              {goals.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label} — {g.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Protein Multiplier */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Protein (g per kg bodyweight)
            </label>
            <input
              type="number"
              step="0.1"
              value={proteinMultiplier}
              onChange={(e) => setProteinMultiplier(parseFloat(e.target.value) || 1.6)}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-yellow-400"
            />
            <p className="text-xs text-zinc-500 mt-1">Typical: 1.6-2.2g for muscle building</p>
          </div>

          {/* Calculate Button */}
          <button
            onClick={calculate}
            className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors"
          >
            Calculate
          </button>

          {/* Results */}
          {result && (
            <div className="mt-4 p-4 bg-zinc-900 rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">BMR (at rest)</span>
                <span className="text-white font-medium">{result.bmr} cal</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">TDEE (daily target)</span>
                <span className="text-yellow-400 font-bold text-lg">{result.tdee} cal</span>
              </div>
              <div className="h-px bg-zinc-700 my-2" />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-blue-400 font-bold">{result.protein}g</div>
                  <div className="text-xs text-zinc-500">Protein</div>
                </div>
                <div>
                  <div className="text-yellow-400 font-bold">{result.carbs}g</div>
                  <div className="text-xs text-zinc-500">Carbs</div>
                </div>
                <div>
                  <div className="text-red-400 font-bold">{result.fats}g</div>
                  <div className="text-xs text-zinc-500">Fats</div>
                </div>
              </div>

              {onApply && (
                <button
                  onClick={handleApply}
                  className="w-full mt-3 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-medium rounded-lg transition-colors"
                >
                  Apply to Plan
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
