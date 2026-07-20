import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

interface Props {
  cardColor: string
  textColor: string
  exploreActive: boolean
  comboCount: number
  comboIndex: number
  /** Increment to trigger the one-shot "combos arrived" pulse. */
  pulseKey: number
  onTap: () => void
}

/** Active dot uses the current text colour — unless it would vanish on near-black. */
function dotColour(textHex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(textHex.trim())
  if (!m) return '#F8F9F9'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance < 0.16 ? '#F8F9F9' : textHex
}

export function PreviewCard({
  cardColor,
  textColor,
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
    <div className="hero-wrap">
      <motion.button
        type="button"
        className="hero-card"
        disabled={!exploreActive}
        onClick={onTap}
        aria-label={
          exploreActive
            ? `Combo ${comboIndex + 1} of ${comboCount}. Tap to cycle to the next combo.`
            : 'Colour preview'
        }
        style={{ cursor: exploreActive ? 'pointer' : 'default' }}
        initial={false}
        animate={{
          backgroundColor: cardColor,
          color: textColor,
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
      </motion.button>
      <AnimatePresence initial={false}>
        {exploreActive && comboCount > 1 && (
          <motion.div
            className="hero-dots"
            aria-hidden="true"
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduced ? 0.01 : 0.2, ease: 'easeOut' }}
          >
            {Array.from({ length: comboCount }, (_, i) => (
              <span
                key={i}
                className="hero-dot"
                style={
                  i === comboIndex ? { backgroundColor: dotColour(textColor) } : undefined
                }
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
