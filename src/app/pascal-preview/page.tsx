'use client'

import Pascal from '@/components/Pascal'
import { PASCAL_MAX, scoreToStage, stageToTier } from '@/app/lib/pascal'
import { useState } from 'react'

const TIER_ARCHETYPES = [
  { label: 'Very unfit', score: 20, note: 'Tier 1 · Stage 3 · sad droop + sweat' },
  { label: 'Neutral', score: 75, note: 'Tier 2 · Stage 8 · breathe + occasional yawn' },
  { label: 'Getting fit', score: 130, note: 'Tier 3 · Stage 14 · lively bounce + smile' },
  { label: 'Peak fit', score: 185, note: 'Tier 4 · Stage 19 · flex + sparkles' },
]

export default function PascalPreview() {
  const [score, setScore] = useState(100)
  const stage = scoreToStage(score)
  const tier = stageToTier(stage)

  return (
    <div className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-bold mb-2">Pascal preview</h1>
          <p className="text-zinc-400">
            Every tier shown below is fully animated. Drag the slider to sweep the
            full 0–200 range.
          </p>
        </div>

        {/* Tier grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {TIER_ARCHETYPES.map((t) => (
            <div
              key={t.score}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center"
            >
              <Pascal score={t.score} />
              <p className="mt-3 text-lg font-semibold">{t.label}</p>
              <p className="text-sm text-zinc-500 text-center mt-1">{t.note}</p>
              <p className="mt-2 text-xs text-zinc-600 tabular-nums">
                Score {t.score} / {PASCAL_MAX}
              </p>
            </div>
          ))}
        </section>

        {/* Slider */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <div className="flex flex-col items-center gap-4">
            <Pascal score={score} size={160} />
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums">
                {score} / {PASCAL_MAX}
              </p>
              <p className="text-zinc-500 text-sm uppercase tracking-wider mt-1">
                Stage {stage} · Tier {tier}
              </p>
            </div>
            <input
              type="range"
              min={0}
              max={PASCAL_MAX}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full max-w-md accent-yellow-400"
            />
            <div className="flex gap-2 text-xs text-zinc-500">
              {[0, 50, 100, 150, 200].map((s) => (
                <button
                  key={s}
                  onClick={() => setScore(s)}
                  className="px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-zinc-600">
          This preview page is dev/test only — remove the route before shipping publicly.
        </p>
      </div>
    </div>
  )
}
