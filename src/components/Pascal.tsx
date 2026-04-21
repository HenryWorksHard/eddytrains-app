'use client'

import { memo } from 'react'
import { scoreToStage, stageToTier, PASCAL_MAX } from '@/app/lib/pascal'

/**
 * Pascal — the fitness-consistency mascot.
 *
 * Parameterized pixel-style SVG. Every stage from 1..20 produces a visually
 * distinct character because most visual dimensions (shoulder width, waist
 * taper, arm thickness, muscle detail, chest line, abs, mouth curve,
 * accessories) are computed from `stage` continuously or at fine thresholds.
 *
 * Tier-level CSS animations still apply (droop, breathe, bounce, flex) to
 * give each tier group a different personality, but within a tier the
 * body progressively tightens up and muscles emerge.
 */
type Props = {
  score: number
  size?: number
}

const SKIN = '#fbbf24'
const SKIN_SHADE = '#d97706'
const SKIN_HI = '#fde68a'
const OUTFIT = '#27272a'
const OUTFIT_SHADE = '#18181b'
const ACCENT = '#facc15'
const ACCENT_HI = '#fef08a'
const EYE = '#111111'
const MOUTH = '#78350f'
const SWEAT = '#60a5fa'
const TEAR = '#93c5fd'

function PascalInner({ score, size = 120 }: Props) {
  const stage = scoreToStage(score)
  const tier = stageToTier(stage)

  // Normalized progress 0..1 across the full stage range
  const t = (stage - 1) / 19

  // Body dimensions — shoulders widen at the top, waist tightens with fitness.
  const shoulderW = round(lerp(18, 26, Math.pow(t, 1.1)))
  const waistW = round(lerp(22, 12, easeInOut(t)))
  const chestTopY = 18
  const chestH = 4
  const waistY = chestTopY + chestH // 22
  const torsoBottomY = 32

  // x-coords for drawing
  const shoulderLeft = 24 - shoulderW / 2
  const waistLeft = 24 - waistW / 2

  // Arms — thicken with fitness, and at the top tier flex upward
  const armW = round(lerp(3, 5, t))
  const flexArms = stage >= 16

  // Expression — mouth curve goes from frown (-3) → flat → big grin (+3)
  const mouthOffset = Math.max(-3, Math.min(3, Math.round((stage - 10.5) / 2)))
  const showSadEyes = stage <= 3
  const showTear = stage <= 2
  const showSweat = stage <= 4

  // Body markings — chest line, abs, bicep peaks appear at thresholds
  const showChestLine = stage >= 11
  const abRows = stage >= 18 ? 3 : stage >= 15 ? 2 : stage >= 12 ? 1 : 0
  const showBicepPeak = stage >= 13
  const showBicepDef = stage >= 17
  const showTricepLine = stage >= 15

  // Accent / outfit detail
  const accentIntensity = clamp01((stage - 8) / 10)
  const showArmBand = stage >= 16
  const showBelt = stage >= 11
  const showSparkles = stage >= 18

  // Posture: at low stages, slight downward lean; high stages, slight lift
  const bodyYOffset = stage <= 4 ? 1 : stage >= 17 ? -1 : 0

  // Head bob/scale subtle with tier, handled via CSS; inline props here.

  return (
    <>
      <div
        className="pascal-root relative select-none"
        style={{ width: size, height: size }}
        data-tier={tier}
        aria-label={`Pascal — stage ${stage} of 20, score ${score}/${PASCAL_MAX}`}
      >
        <svg viewBox="0 0 48 52" width={size} height={size} shapeRendering="crispEdges" className="pascal-svg">
          {/* Sparkles around peak-fit Pascal */}
          {showSparkles && (
            <g className="pascal-sparkles">
              <rect x="4" y="8" width="2" height="2" fill={ACCENT} />
              <rect x="42" y="10" width="2" height="2" fill={ACCENT} />
              <rect x="6" y="24" width="2" height="2" fill={ACCENT_HI} />
              <rect x="40" y="28" width="2" height="2" fill={ACCENT_HI} />
              <rect x="8" y="38" width="2" height="2" fill={ACCENT} />
              <rect x="40" y="40" width="2" height="2" fill={ACCENT} />
            </g>
          )}

          {/* Ground shadow */}
          <ellipse cx="24" cy="50" rx={shoulderW * 0.4 + 4} ry="1.4" fill="#000" opacity="0.35" />

          <g
            className="pascal-body"
            transform={`translate(0 ${bodyYOffset})`}
          >
            {/* HEAD */}
            <Head
              stage={stage}
              showSadEyes={showSadEyes}
              showTear={showTear}
              showSweat={showSweat}
              mouthOffset={mouthOffset}
            />

            {/* NECK */}
            <rect x="22" y="16" width="4" height="2" fill={SKIN_SHADE} />

            {/* SHOULDERS + UPPER TORSO */}
            <rect x={shoulderLeft} y={chestTopY} width={shoulderW} height={chestH} fill={OUTFIT} />
            {/* Shoulder highlights */}
            <rect x={shoulderLeft} y={chestTopY} width="1" height={chestH} fill={OUTFIT_SHADE} />
            <rect x={shoulderLeft + shoulderW - 1} y={chestTopY} width="1" height={chestH} fill={OUTFIT_SHADE} />

            {/* MIDSECTION - tapered trapezoid via stepped rects */}
            <Torso
              shoulderW={shoulderW}
              waistW={waistW}
              chestTopY={chestTopY}
              chestH={chestH}
              waistY={waistY}
              torsoBottomY={torsoBottomY}
            />

            {/* CHEST LINE (pec split) */}
            {showChestLine && (
              <rect x="23" y={chestTopY + 2} width="2" height="2" fill={OUTFIT_SHADE} opacity="0.75" />
            )}

            {/* ACCENT BAND / LOGO across chest */}
            {accentIntensity > 0.15 && (
              <rect
                x={waistLeft + 2}
                y={chestTopY + 1}
                width={waistW - 4}
                height="1"
                fill={ACCENT}
                opacity={accentIntensity}
              />
            )}
            {showArmBand && (
              <>
                {/* Right sleeve band */}
                <rect x={shoulderLeft + shoulderW - 2} y={chestTopY + 1} width="2" height="2" fill={ACCENT} />
                {/* Left sleeve band */}
                <rect x={shoulderLeft} y={chestTopY + 1} width="2" height="2" fill={ACCENT} />
              </>
            )}

            {/* ABS */}
            {abRows > 0 && (
              <g>
                {/* central line */}
                <rect x="23" y={waistY} width="1" height={torsoBottomY - waistY} fill={OUTFIT_SHADE} opacity="0.7" />
                {Array.from({ length: abRows }).map((_, i) => {
                  const y = waistY + 1 + i * 2
                  return (
                    <g key={i}>
                      <rect x="21" y={y} width="2" height="1" fill={OUTFIT_SHADE} opacity="0.6" />
                      <rect x="25" y={y} width="2" height="1" fill={OUTFIT_SHADE} opacity="0.6" />
                    </g>
                  )
                })}
              </g>
            )}

            {/* BELT */}
            {showBelt && (
              <rect x={waistLeft + 1} y={torsoBottomY - 1} width={waistW - 2} height="1" fill={ACCENT} />
            )}

            {/* ARMS */}
            {flexArms ? (
              <FlexedArms armW={armW} shoulderLeft={shoulderLeft} shoulderW={shoulderW} showBicepDef={showBicepDef} />
            ) : (
              <RelaxedArms
                armW={armW}
                shoulderLeft={shoulderLeft}
                shoulderW={shoulderW}
                showBicepPeak={showBicepPeak}
                showTricepLine={showTricepLine}
                stage={stage}
              />
            )}

            {/* LEGS */}
            <Legs stage={stage} waistLeft={waistLeft} waistW={waistW} torsoBottomY={torsoBottomY} />
          </g>
        </svg>
      </div>

      <style jsx global>{`
        @keyframes pascal-eye-shift {
          0%, 40% { transform: translateX(0); }
          50%, 70% { transform: translateX(-0.5px); }
          80%, 100% { transform: translateX(0.5px); }
        }
        .pascal-eye { transform-origin: center; animation: pascal-eye-shift 4s ease-in-out infinite; }

        @keyframes pascal-droop {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(1px) rotate(1deg); }
        }
        .pascal-root[data-tier='1'] .pascal-body { transform-origin: center bottom; animation: pascal-droop 4.5s ease-in-out infinite; }

        @keyframes pascal-sweat-drop {
          0%, 30% { opacity: 0; transform: translateY(-2px); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateY(4px); }
        }
        .pascal-root .pascal-sweat { animation: pascal-sweat-drop 3s ease-in infinite; }

        @keyframes pascal-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-0.5px); }
        }
        .pascal-root[data-tier='2'] .pascal-body { transform-origin: center bottom; animation: pascal-breathe 3s ease-in-out infinite; }

        @keyframes pascal-bounce {
          0%, 100% { transform: translateY(0); }
          30% { transform: translateY(-2px); }
          60% { transform: translateY(0); }
        }
        .pascal-root[data-tier='3'] .pascal-body { transform-origin: center bottom; animation: pascal-bounce 1.8s ease-in-out infinite; }

        @keyframes pascal-flex-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-3px) scale(1.03); }
          60% { transform: translateY(0) scale(1); }
        }
        @keyframes pascal-sparkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        .pascal-root[data-tier='4'] .pascal-body { transform-origin: center bottom; animation: pascal-flex-bounce 1.4s ease-in-out infinite; }
        .pascal-root[data-tier='4'] .pascal-sparkles rect { animation: pascal-sparkle 1.5s ease-in-out infinite; }
        .pascal-root[data-tier='4'] .pascal-sparkles rect:nth-child(even) { animation-delay: 0.6s; }

        @media (prefers-reduced-motion: reduce) {
          .pascal-root * { animation: none !important; }
        }
      `}</style>
    </>
  )
}

const Pascal = memo(PascalInner)
export default Pascal

/* ----- helpers ----- */

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp01(t)
}
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}
function round(v: number) {
  return Math.round(v)
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/* ----- subcomponents ----- */

function Head({
  stage,
  showSadEyes,
  showTear,
  showSweat,
  mouthOffset,
}: {
  stage: number
  showSadEyes: boolean
  showTear: boolean
  showSweat: boolean
  mouthOffset: number
}) {
  // Head gets slightly narrower at high stages (leaner face)
  const headW = stage >= 14 ? 10 : 11
  const headLeft = 24 - headW / 2
  const eyesY = 11
  const mouthY = 14

  return (
    <g>
      {/* Head block */}
      <rect x={headLeft} y="6" width={headW} height="10" fill={SKIN} />
      {/* Jaw shadow */}
      <rect x={headLeft} y="15" width={headW} height="1" fill={SKIN_SHADE} />
      {/* Hair / top shade */}
      <rect x={headLeft} y="6" width={headW} height="1" fill={SKIN_SHADE} />

      {/* Eyes */}
      <g className="pascal-eye">
        {showSadEyes ? (
          <>
            {/* Sad closed eyes */}
            <rect x="20" y={eyesY} width="2" height="1" fill={EYE} />
            <rect x="26" y={eyesY} width="2" height="1" fill={EYE} />
          </>
        ) : (
          <>
            <rect x="20" y={eyesY} width="2" height="2" fill={EYE} />
            <rect x="26" y={eyesY} width="2" height="2" fill={EYE} />
            {/* Eye highlight at higher stages */}
            {stage >= 15 && (
              <>
                <rect x="20" y={eyesY} width="1" height="1" fill="#ffffff" />
                <rect x="26" y={eyesY} width="1" height="1" fill="#ffffff" />
              </>
            )}
          </>
        )}
      </g>

      {/* Eyebrows — angle depends on stage */}
      {stage >= 14 ? (
        <>
          <rect x="19" y={eyesY - 1} width="3" height="1" fill={SKIN_SHADE} />
          <rect x="26" y={eyesY - 1} width="3" height="1" fill={SKIN_SHADE} />
        </>
      ) : stage <= 5 ? (
        <>
          <rect x="19" y={eyesY - 1} width="3" height="1" fill={SKIN_SHADE} />
          <rect x="20" y={eyesY - 2} width="1" height="1" fill={SKIN_SHADE} />
          <rect x="26" y={eyesY - 1} width="3" height="1" fill={SKIN_SHADE} />
          <rect x="28" y={eyesY - 2} width="1" height="1" fill={SKIN_SHADE} />
        </>
      ) : null}

      {/* Mouth - curve mapped from -3 (frown) to +3 (big grin) */}
      <Mouth offset={mouthOffset} y={mouthY} />

      {/* Cheek blush at top tiers */}
      {stage >= 16 && (
        <>
          <rect x={headLeft - 1} y="13" width="1" height="1" fill="#f87171" opacity="0.6" />
          <rect x={headLeft + headW} y="13" width="1" height="1" fill="#f87171" opacity="0.6" />
        </>
      )}

      {/* Tear */}
      {showTear && <rect x="21" y="13" width="1" height="2" fill={TEAR} />}

      {/* Sweat drop */}
      {showSweat && <rect className="pascal-sweat" x={headLeft + headW + 1} y="6" width="2" height="3" fill={SWEAT} />}

      {/* Headband at top tier */}
      {stage >= 19 && (
        <>
          <rect x={headLeft} y="7" width={headW} height="1" fill={ACCENT} />
          <rect x={headLeft + 2} y="6" width="2" height="2" fill={ACCENT} />
        </>
      )}
    </g>
  )
}

function Mouth({ offset, y }: { offset: number; y: number }) {
  // offset: -3 big frown, -1 small frown, 0 flat, +1 small smile, +3 big grin
  if (offset <= -2) {
    return (
      <g>
        <rect x="22" y={y + 1} width="1" height="1" fill={MOUTH} />
        <rect x="23" y={y} width="2" height="1" fill={MOUTH} />
        <rect x="25" y={y + 1} width="1" height="1" fill={MOUTH} />
      </g>
    )
  }
  if (offset <= -1) {
    return (
      <g>
        <rect x="22" y={y} width="1" height="1" fill={MOUTH} />
        <rect x="23" y={y - 1} width="2" height="1" fill={MOUTH} />
        <rect x="25" y={y} width="1" height="1" fill={MOUTH} />
      </g>
    )
  }
  if (offset === 0) {
    return <rect x="22" y={y} width="4" height="1" fill={MOUTH} />
  }
  if (offset === 1) {
    return (
      <g>
        <rect x="22" y={y} width="1" height="1" fill={MOUTH} />
        <rect x="23" y={y + 1} width="2" height="1" fill={MOUTH} />
        <rect x="25" y={y} width="1" height="1" fill={MOUTH} />
      </g>
    )
  }
  if (offset === 2) {
    return (
      <g>
        <rect x="22" y={y - 1} width="1" height="1" fill={MOUTH} />
        <rect x="22" y={y} width="4" height="1" fill={MOUTH} />
        <rect x="25" y={y - 1} width="1" height="1" fill={MOUTH} />
      </g>
    )
  }
  // +3 big grin, teeth visible
  return (
    <g>
      <rect x="21" y={y - 1} width="1" height="1" fill={MOUTH} />
      <rect x="22" y={y} width="4" height="1" fill={MOUTH} />
      <rect x="22" y={y + 1} width="4" height="1" fill="#ffffff" />
      <rect x="26" y={y - 1} width="1" height="1" fill={MOUTH} />
    </g>
  )
}

function Torso({
  shoulderW,
  waistW,
  chestTopY,
  chestH,
  waistY,
  torsoBottomY,
}: {
  shoulderW: number
  waistW: number
  chestTopY: number
  chestH: number
  waistY: number
  torsoBottomY: number
}) {
  // Taper from shoulders to waist over a few horizontal bands
  const bandCount = torsoBottomY - waistY + 1 // e.g. 22..32
  const bands: React.ReactElement[] = []
  for (let i = 0; i < bandCount; i++) {
    const ti = i / Math.max(1, bandCount - 1)
    const w = round(lerp(shoulderW, waistW, easeInOut(ti)))
    const x = 24 - w / 2
    const y = waistY + i
    bands.push(<rect key={i} x={x} y={y} width={w} height="1" fill={OUTFIT} />)
  }
  // Outline shadow on sides for depth
  bands.push(
    <rect key="sl" x={24 - shoulderW / 2} y={chestTopY} width="1" height={chestH} fill={OUTFIT_SHADE} />
  )
  bands.push(
    <rect key="sr" x={24 + shoulderW / 2 - 1} y={chestTopY} width="1" height={chestH} fill={OUTFIT_SHADE} />
  )
  return <g>{bands}</g>
}

function RelaxedArms({
  armW,
  shoulderLeft,
  shoulderW,
  showBicepPeak,
  showTricepLine,
  stage,
}: {
  armW: number
  shoulderLeft: number
  shoulderW: number
  showBicepPeak: boolean
  showTricepLine: boolean
  stage: number
}) {
  const leftX = shoulderLeft - armW
  const rightX = shoulderLeft + shoulderW
  const topY = 19
  const height = stage <= 4 ? 11 : 10

  return (
    <g>
      {/* Left arm */}
      <rect x={leftX} y={topY} width={armW} height={height} fill={SKIN} />
      {/* Right arm */}
      <rect x={rightX} y={topY} width={armW} height={height} fill={SKIN} />

      {/* Bicep peak (slight bulge upper-outer) */}
      {showBicepPeak && (
        <>
          <rect x={leftX - 1} y={topY + 1} width="1" height="2" fill={SKIN} />
          <rect x={rightX + armW} y={topY + 1} width="1" height="2" fill={SKIN} />
        </>
      )}

      {/* Bicep shadow line */}
      {showTricepLine && (
        <>
          <rect x={leftX} y={topY + 1} width="1" height="3" fill={SKIN_SHADE} />
          <rect x={rightX + armW - 1} y={topY + 1} width="1" height="3" fill={SKIN_SHADE} />
        </>
      )}

      {/* Forearm highlight at higher stages */}
      {stage >= 15 && (
        <>
          <rect x={leftX + armW - 1} y={topY + 6} width="1" height={height - 6} fill={SKIN_HI} opacity="0.6" />
          <rect x={rightX} y={topY + 6} width="1" height={height - 6} fill={SKIN_HI} opacity="0.6" />
        </>
      )}
    </g>
  )
}

function FlexedArms({
  armW,
  shoulderLeft,
  shoulderW,
  showBicepDef,
}: {
  armW: number
  shoulderLeft: number
  shoulderW: number
  showBicepDef: boolean
}) {
  // Upper (forearm) goes up, lower (bicep) goes across. Two-segment L shape on each side.
  const leftShoulderX = shoulderLeft
  const rightShoulderX = shoulderLeft + shoulderW - armW

  return (
    <g>
      {/* LEFT arm: forearm vertical up */}
      <rect x={leftShoulderX - armW} y="14" width={armW} height="6" fill={SKIN} />
      {/* LEFT bicep: bulge */}
      <rect x={leftShoulderX - armW - 1} y="17" width={armW + 1} height="4" fill={SKIN} />
      {/* LEFT fist */}
      <rect x={leftShoulderX - armW} y="12" width={armW} height="2" fill={SKIN_SHADE} />

      {/* RIGHT arm: forearm vertical up */}
      <rect x={rightShoulderX + armW} y="14" width={armW} height="6" fill={SKIN} />
      {/* RIGHT bicep: bulge */}
      <rect x={rightShoulderX + armW} y="17" width={armW + 1} height="4" fill={SKIN} />
      {/* RIGHT fist */}
      <rect x={rightShoulderX + armW} y="12" width={armW} height="2" fill={SKIN_SHADE} />

      {/* Bicep definition — diagonal shade line */}
      {showBicepDef && (
        <>
          <rect x={leftShoulderX - armW} y="18" width="1" height="2" fill={SKIN_SHADE} />
          <rect x={rightShoulderX + armW + armW} y="18" width="1" height="2" fill={SKIN_SHADE} />
          <rect x={leftShoulderX - armW - 1} y="19" width="1" height="1" fill={SKIN_HI} />
          <rect x={rightShoulderX + armW + armW} y="19" width="1" height="1" fill={SKIN_HI} />
        </>
      )}
    </g>
  )
}

function Legs({
  stage,
  waistLeft,
  waistW,
  torsoBottomY,
}: {
  stage: number
  waistLeft: number
  waistW: number
  torsoBottomY: number
}) {
  const gap = stage <= 4 ? 2 : stage >= 16 ? 4 : 3
  const legW = Math.max(3, Math.floor((waistW - gap) / 2))
  const leftX = waistLeft
  const rightX = waistLeft + waistW - legW
  const legTop = torsoBottomY + 1
  const legBottom = 46
  const legH = legBottom - legTop

  return (
    <g>
      {/* Shorts */}
      <rect x={leftX} y={legTop} width={legW} height="3" fill={OUTFIT_SHADE} />
      <rect x={rightX} y={legTop} width={legW} height="3" fill={OUTFIT_SHADE} />
      {/* Legs */}
      <rect x={leftX} y={legTop + 3} width={legW} height={legH - 3} fill={SKIN} />
      <rect x={rightX} y={legTop + 3} width={legW} height={legH - 3} fill={SKIN} />
      {/* Quad highlight at higher stages */}
      {stage >= 14 && (
        <>
          <rect x={leftX} y={legTop + 3} width="1" height={legH - 4} fill={SKIN_HI} opacity="0.6" />
          <rect x={rightX + legW - 1} y={legTop + 3} width="1" height={legH - 4} fill={SKIN_HI} opacity="0.6" />
        </>
      )}
      {/* Shoes */}
      <rect x={leftX - 1} y={legBottom} width={legW + 1} height="1" fill={OUTFIT} />
      <rect x={rightX} y={legBottom} width={legW + 1} height="1" fill={OUTFIT} />
    </g>
  )
}
