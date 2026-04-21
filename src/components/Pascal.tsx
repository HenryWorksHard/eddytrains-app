'use client'

import { memo } from 'react'
import { scoreToStage, stageToTier, PASCAL_MAX } from '@/app/lib/pascal'

/**
 * Pascal — the fitness-consistency mascot.
 *
 * 4 visual tiers mapped from stage 1..20. Each tier has its own
 * body proportions, expression, pose and animation. Rendered as a
 * single pixel-style SVG; animations are CSS keyframes scoped via
 * <style jsx global>.
 *
 * Tier 1 (stages 1-5):  unfit, slouched, sad
 * Tier 2 (stages 6-10): neutral, average, idle
 * Tier 3 (stages 11-15): fit, smiling, bouncy
 * Tier 4 (stages 16-20): peak, muscular, flexing
 */
type Props = {
  score: number
  /** If true, renders a smaller variant suitable for inline use. Default 120px */
  size?: number
}

function PascalInner({ score, size = 120 }: Props) {
  const stage = scoreToStage(score)
  const tier = stageToTier(stage)

  return (
    <>
      <div
        className="pascal-root relative select-none"
        style={{ width: size, height: size }}
        data-tier={tier}
        aria-label={`Pascal — stage ${stage} of 20, score ${score}/${PASCAL_MAX}`}
      >
        <svg
          viewBox="0 0 48 48"
          width={size}
          height={size}
          shapeRendering="crispEdges"
          className="pascal-svg"
        >
          {/* Backdrop glow — only for the top tier */}
          {tier === 4 && (
            <g className="pascal-sparkles">
              <rect x="4" y="8" width="2" height="2" fill="#facc15" />
              <rect x="42" y="12" width="2" height="2" fill="#facc15" />
              <rect x="8" y="22" width="2" height="2" fill="#facc15" />
              <rect x="40" y="26" width="2" height="2" fill="#facc15" />
              <rect x="6" y="36" width="2" height="2" fill="#facc15" />
              <rect x="42" y="38" width="2" height="2" fill="#facc15" />
            </g>
          )}

          {/* Shadow */}
          <ellipse cx="24" cy="45" rx="10" ry="1.5" fill="#000" opacity="0.35" />

          {tier === 1 && <TierOne />}
          {tier === 2 && <TierTwo />}
          {tier === 3 && <TierThree />}
          {tier === 4 && <TierFour />}
        </svg>
      </div>

      <style jsx global>{`
        /* Eye shift — applied to ALL tiers, very subtle. */
        @keyframes pascal-eye-shift {
          0%,
          40% {
            transform: translateX(0);
          }
          50%,
          70% {
            transform: translateX(-0.5px);
          }
          80%,
          100% {
            transform: translateX(0.5px);
          }
        }
        .pascal-eye {
          transform-origin: center;
          animation: pascal-eye-shift 4s ease-in-out infinite;
        }

        /* Tier 1 — slow slouch droop */
        @keyframes pascal-droop {
          0%,
          100% {
            transform: translateY(0) rotate(-1deg);
          }
          50% {
            transform: translateY(1px) rotate(1deg);
          }
        }
        .pascal-root[data-tier='1'] .pascal-body {
          transform-origin: center bottom;
          animation: pascal-droop 4.5s ease-in-out infinite;
        }
        .pascal-root[data-tier='1'] .pascal-sweat {
          animation: pascal-sweat-drop 3s ease-in infinite;
        }
        @keyframes pascal-sweat-drop {
          0%,
          30% {
            opacity: 0;
            transform: translateY(-2px);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(4px);
          }
        }

        /* Tier 2 — neutral breathe + occasional yawn (eyelids close briefly) */
        @keyframes pascal-breathe {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-0.5px);
          }
        }
        @keyframes pascal-yawn {
          0%,
          92%,
          100% {
            transform: scaleY(1);
          }
          95% {
            transform: scaleY(0.1);
          }
        }
        .pascal-root[data-tier='2'] .pascal-body {
          transform-origin: center bottom;
          animation: pascal-breathe 3s ease-in-out infinite;
        }
        .pascal-root[data-tier='2'] .pascal-eyelid {
          transform-origin: center;
          animation: pascal-yawn 8s ease-in-out infinite;
        }

        /* Tier 3 — lively bounce */
        @keyframes pascal-bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-2px);
          }
          60% {
            transform: translateY(0);
          }
        }
        .pascal-root[data-tier='3'] .pascal-body {
          transform-origin: center bottom;
          animation: pascal-bounce 1.8s ease-in-out infinite;
        }

        /* Tier 4 — flex + happy bounce + sparkle */
        @keyframes pascal-flex-bounce {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          40% {
            transform: translateY(-3px) scale(1.03);
          }
          60% {
            transform: translateY(0) scale(1);
          }
        }
        @keyframes pascal-sparkle {
          0%,
          100% {
            opacity: 0.2;
          }
          50% {
            opacity: 1;
          }
        }
        .pascal-root[data-tier='4'] .pascal-body {
          transform-origin: center bottom;
          animation: pascal-flex-bounce 1.4s ease-in-out infinite;
        }
        .pascal-root[data-tier='4'] .pascal-sparkles rect {
          animation: pascal-sparkle 1.5s ease-in-out infinite;
        }
        .pascal-root[data-tier='4'] .pascal-sparkles rect:nth-child(even) {
          animation-delay: 0.6s;
        }

        @media (prefers-reduced-motion: reduce) {
          .pascal-root * {
            animation: none !important;
          }
        }
      `}</style>
    </>
  )
}

const Pascal = memo(PascalInner)
export default Pascal

/* ---------------------------------------------------------------------- */
/* Tier renderers. 48×48 pixel grid, rendered crisp. Shared palette:      */
/* skin #fbbf24 darker #d97706 — outfit #27272a accent #facc15 eye #111.  */
/* ---------------------------------------------------------------------- */

const SKIN = '#fbbf24'
const SKIN_SHADE = '#d97706'
const OUTFIT = '#27272a'
const ACCENT = '#facc15'
const EYE = '#111111'
const MOUTH = '#78350f'
const SWEAT = '#60a5fa'

/** Tier 1 — pear body, slouched, frowning */
function TierOne() {
  return (
    <g className="pascal-body">
      {/* Head */}
      <rect x="18" y="8" width="12" height="10" fill={SKIN} />
      <rect x="18" y="17" width="12" height="1" fill={SKIN_SHADE} />
      {/* Cheeks (chubby) */}
      <rect x="16" y="12" width="2" height="4" fill={SKIN} />
      <rect x="30" y="12" width="2" height="4" fill={SKIN} />
      {/* Eyes (half-closed, sad) */}
      <g className="pascal-eye">
        <rect x="21" y="13" width="2" height="1" fill={EYE} />
        <rect x="25" y="13" width="2" height="1" fill={EYE} />
      </g>
      {/* Frown */}
      <rect x="22" y="16" width="1" height="1" fill={MOUTH} />
      <rect x="23" y="15" width="2" height="1" fill={MOUTH} />
      <rect x="25" y="16" width="1" height="1" fill={MOUTH} />
      {/* Body — wide rounded torso */}
      <rect x="14" y="19" width="20" height="14" fill={OUTFIT} />
      <rect x="13" y="21" width="1" height="10" fill={OUTFIT} />
      <rect x="34" y="21" width="1" height="10" fill={OUTFIT} />
      <rect x="15" y="33" width="18" height="2" fill={OUTFIT} />
      {/* Accent band (soft, no energy) */}
      <rect x="14" y="27" width="20" height="1" fill="#52525b" />
      {/* Arms — drooping */}
      <rect x="11" y="22" width="3" height="10" fill={SKIN} />
      <rect x="34" y="22" width="3" height="10" fill={SKIN} />
      {/* Legs */}
      <rect x="17" y="35" width="4" height="9" fill={OUTFIT} />
      <rect x="27" y="35" width="4" height="9" fill={OUTFIT} />
      {/* Sweat drop */}
      <rect className="pascal-sweat" x="32" y="8" width="2" height="3" fill={SWEAT} />
    </g>
  )
}

/** Tier 2 — average/neutral */
function TierTwo() {
  return (
    <g className="pascal-body">
      {/* Head */}
      <rect x="19" y="8" width="10" height="10" fill={SKIN} />
      <rect x="19" y="17" width="10" height="1" fill={SKIN_SHADE} />
      {/* Eyes */}
      <g className="pascal-eye">
        <rect x="21" y="12" width="2" height="2" fill={EYE} />
        <rect x="25" y="12" width="2" height="2" fill={EYE} />
        {/* Eyelid for yawn animation */}
        <rect className="pascal-eyelid" x="21" y="13" width="6" height="0" fill={SKIN} />
      </g>
      {/* Neutral mouth */}
      <rect x="22" y="16" width="4" height="1" fill={MOUTH} />
      {/* Body — average torso */}
      <rect x="16" y="19" width="16" height="13" fill={OUTFIT} />
      <rect x="16" y="32" width="16" height="2" fill={OUTFIT} />
      {/* Subtle accent line */}
      <rect x="16" y="25" width="16" height="1" fill={ACCENT} opacity="0.6" />
      {/* Arms */}
      <rect x="13" y="21" width="3" height="10" fill={SKIN} />
      <rect x="32" y="21" width="3" height="10" fill={SKIN} />
      {/* Legs */}
      <rect x="18" y="34" width="4" height="10" fill={OUTFIT} />
      <rect x="26" y="34" width="4" height="10" fill={OUTFIT} />
    </g>
  )
}

/** Tier 3 — fit, smiling */
function TierThree() {
  return (
    <g className="pascal-body">
      {/* Head */}
      <rect x="19" y="8" width="10" height="9" fill={SKIN} />
      <rect x="19" y="16" width="10" height="1" fill={SKIN_SHADE} />
      {/* Eyes */}
      <g className="pascal-eye">
        <rect x="21" y="12" width="2" height="2" fill={EYE} />
        <rect x="25" y="12" width="2" height="2" fill={EYE} />
      </g>
      {/* Smile */}
      <rect x="22" y="15" width="1" height="1" fill={MOUTH} />
      <rect x="23" y="16" width="2" height="1" fill={MOUTH} />
      <rect x="25" y="15" width="1" height="1" fill={MOUTH} />
      {/* Body — trimmer torso with defined shoulders */}
      <rect x="16" y="18" width="16" height="13" fill={OUTFIT} />
      <rect x="15" y="19" width="1" height="10" fill={OUTFIT} />
      <rect x="32" y="19" width="1" height="10" fill={OUTFIT} />
      {/* Bold accent chevron */}
      <rect x="22" y="22" width="4" height="1" fill={ACCENT} />
      <rect x="21" y="23" width="6" height="1" fill={ACCENT} />
      <rect x="20" y="24" width="8" height="1" fill={ACCENT} />
      {/* Arms — slight outward stance */}
      <rect x="13" y="20" width="3" height="9" fill={SKIN} />
      <rect x="32" y="20" width="3" height="9" fill={SKIN} />
      {/* Legs */}
      <rect x="18" y="31" width="4" height="13" fill={OUTFIT} />
      <rect x="26" y="31" width="4" height="13" fill={OUTFIT} />
    </g>
  )
}

/** Tier 4 — peak fit, flexing, big smile */
function TierFour() {
  return (
    <g className="pascal-body">
      {/* Head */}
      <rect x="19" y="9" width="10" height="9" fill={SKIN} />
      <rect x="19" y="17" width="10" height="1" fill={SKIN_SHADE} />
      {/* Eyes */}
      <g className="pascal-eye">
        <rect x="21" y="12" width="2" height="2" fill={EYE} />
        <rect x="25" y="12" width="2" height="2" fill={EYE} />
      </g>
      {/* Big grin */}
      <rect x="21" y="15" width="1" height="1" fill={MOUTH} />
      <rect x="22" y="16" width="4" height="1" fill={MOUTH} />
      <rect x="26" y="15" width="1" height="1" fill={MOUTH} />
      {/* Torso — broad shoulders, V-shape */}
      <rect x="14" y="19" width="20" height="4" fill={OUTFIT} />
      <rect x="15" y="23" width="18" height="3" fill={OUTFIT} />
      <rect x="16" y="26" width="16" height="4" fill={OUTFIT} />
      {/* Accent armband + chest line */}
      <rect x="14" y="20" width="20" height="1" fill={ACCENT} />
      <rect x="22" y="23" width="4" height="4" fill={ACCENT} opacity="0.85" />
      {/* Flexed arms — upward bicep curls */}
      <rect x="11" y="22" width="3" height="3" fill={SKIN} />
      <rect x="12" y="19" width="3" height="3" fill={SKIN} />
      <rect x="13" y="16" width="3" height="3" fill={SKIN} />
      <rect x="33" y="22" width="3" height="3" fill={SKIN} />
      <rect x="33" y="19" width="3" height="3" fill={SKIN} />
      <rect x="32" y="16" width="3" height="3" fill={SKIN} />
      {/* Bicep highlights */}
      <rect x="13" y="17" width="1" height="1" fill={SKIN_SHADE} />
      <rect x="34" y="17" width="1" height="1" fill={SKIN_SHADE} />
      {/* Legs — wider stance */}
      <rect x="17" y="30" width="5" height="14" fill={OUTFIT} />
      <rect x="26" y="30" width="5" height="14" fill={OUTFIT} />
    </g>
  )
}
