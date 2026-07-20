import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { fontStack, fontWeightValue } from './FontsSection'
import type { FontKey, FontWeightKey } from './FontsSection'

export interface PreviewTheme {
  cardColor: string
  textColor: string
  cardFont: FontKey
  cardFontWeight: FontWeightKey
}

interface Props {
  theme: PreviewTheme
  exploreActive: boolean
  comboCount: number
  comboIndex: number
  /** Increment to trigger the one-shot "explore armed" pulse. */
  pulseKey: number
  onTap: () => void
}

/** Active explore dot uses the current text colour — unless it would vanish on the black screen. */
function dotColour(textHex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(textHex.trim())
  if (!m) return '#FFFFFF'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance < 0.16 ? '#FFFFFF' : textHex
}

export function PreviewCard({
  theme,
  exploreActive,
  comboCount,
  comboIndex,
  pulseKey,
  onTap,
}: Props) {
  const reduced = useReducedMotion()
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    if (pulseKey > 0 && !reduced) setPulsing(true)
  }, [pulseKey, reduced])

  const spring = { type: 'spring' as const, visualDuration: 0.3, bounce: 0.2 }

  return (
    <div className="preview-wrap">
      <motion.button
        type="button"
        className="preview-card"
        disabled={!exploreActive}
        onClick={onTap}
        aria-label={
          exploreActive
            ? `Preview card, combo ${comboIndex + 1} of ${comboCount}. Tap to explore the next combo.`
            : 'Preview card'
        }
        style={{
          fontFamily: fontStack(theme.cardFont),
          fontWeight: fontWeightValue(theme.cardFontWeight),
          cursor: exploreActive ? 'pointer' : 'default',
        }}
        initial={false}
        animate={{
          backgroundColor: theme.cardColor,
          color: theme.textColor,
          scale: pulsing ? [1, 1.02, 1] : 1,
        }}
        whileTap={exploreActive && !reduced ? { scale: 0.98 } : undefined}
        transition={{
          scale: reduced ? { duration: 0 } : { ...spring, visualDuration: pulsing ? 0.6 : 0.3 },
          backgroundColor: { duration: reduced ? 0 : 0.25, ease: 'easeOut' },
          color: { duration: reduced ? 0 : 0.25, ease: 'easeOut' },
        }}
        onAnimationComplete={() => setPulsing(false)}
      >
        hello, world.
        <AnimatePresence>
          {exploreActive && (
            <motion.span
              className="explore-pill"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.85 }}
              transition={reduced ? { duration: 0.01 } : spring}
            >
              Tap to explore · {comboIndex + 1}/{comboCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <AnimatePresence initial={false}>
        {exploreActive && comboCount > 1 && (
          <motion.div
            className="explore-dots"
            aria-hidden="true"
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduced ? 0.01 : 0.2, ease: 'easeOut' }}
          >
            {Array.from({ length: comboCount }, (_, i) => (
              <span
                key={i}
                className="dot"
                style={
                  i === comboIndex
                    ? { backgroundColor: dotColour(theme.textColor) }
                    : undefined
                }
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
