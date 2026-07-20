import { motion, useReducedMotion } from 'motion/react'
import { normaliseHex } from '../lib/presets'
import type { Preset } from '../lib/types'

interface Props {
  /** Captured presets (newest first) followed by the curated 16. */
  presets: Preset[]
  selectedCard: string
  selectedText: string
  /** id of the just-added captured preset — it scales in. */
  newestId: string | null
  onSelect: (preset: Preset) => void
  onAdd: () => void
}

export function PresetsRow({
  presets,
  selectedCard,
  selectedText,
  newestId,
  onSelect,
  onAdd,
}: Props) {
  const reduced = useReducedMotion()
  const card = normaliseHex(selectedCard)
  const text = normaliseHex(selectedText)

  return (
    <div className="h-row" role="group" aria-label="Colour presets">
      <button
        type="button"
        className="preset-ring"
        aria-label="Add current colours as a preset"
        onClick={onAdd}
      >
        <span className="add-circle">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 4v12M4 10h12"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>
      {presets.map((preset) => {
        const selected =
          normaliseHex(preset.card) === card && normaliseHex(preset.text) === text
        return (
          <motion.button
            key={preset.id}
            type="button"
            layout={!reduced}
            initial={
              preset.id === newestId && !reduced
                ? { scale: 0.4, opacity: 0 }
                : false
            }
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', visualDuration: 0.3, bounce: 0.2 }}
            className="preset-ring"
            data-selected={selected}
            aria-pressed={selected}
            aria-label={
              preset.title ?? `Captured preset, ${preset.card} card with ${preset.text} text`
            }
            onClick={() => onSelect(preset)}
          >
            <span
              className="preset-circle"
              style={{ backgroundColor: preset.card, color: preset.text }}
              aria-hidden="true"
            >
              Aa
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
