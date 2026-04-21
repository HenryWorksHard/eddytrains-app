'use client'

import Pascal from '@/components/Pascal'
import { PASCAL_MAX, scoreToStage, stageToTier } from '@/app/lib/pascal'
import { useState } from 'react'

// One score per stage — pick the middle of each 10-point band so the
// stage number reflects the stage cleanly (e.g. stage 1 → score 5).
const STAGE_SCORES = Array.from({ length: 20 }, (_, i) => i * 10 + 5)

export default function PascalPreview() {
  const [score, setScore] = useState(100)
  const stage = scoreToStage(score)
  const tier = stageToTier(stage)

  return (
    <div className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-bold mb-2">Pascal preview</h1>
          <p className="text-zinc-400">
            Every one of the 20 stages is shown below. Scroll through to see
            how the character progresses. Slider at the bottom for a live
            scrubber.
          </p>
        </div>

        {/* All 20 stages */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
            All 20 stages
          </h2>
          <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-4">
            {STAGE_SCORES.map((s) => {
              const st = scoreToStage(s)
              const ti = stageToTier(st)
              return (
                <div
                  key={s}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center"
                >
                  <Pascal score={s} size={96} />
                  <div className="text-center mt-2">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">
                      Stage {st}
                    </p>
                    <p className="text-xs text-zinc-600 tabular-nums">
                      {s - 4}–{s + 5} pts · Tier {ti}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Scrubber */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 sticky bottom-4">
          <div className="flex flex-col items-center gap-4">
            <Pascal score={score} size={180} />
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
          Dev-only preview — delete src/app/pascal-preview/ before public release.
        </p>
      </div>
    </div>
  )
}
