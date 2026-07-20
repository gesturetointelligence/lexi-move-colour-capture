import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { normaliseHex } from '../lib/presets'
import type { Preset } from '../lib/types'

interface Props {
  /** Captured presets (newest first) followed by the brand seeds. */
  presets: Preset[]
  selectedCard: string
  selectedText: string
  /** id of the just-added captured preset — it scales in. */
  newestId: string | null
  onSelect: (preset: Preset) => void
  onAdd: () => void
  onDelete: (id: string) => void
}

const LONG_PRESS_MS = 450

export function PresetsRow({
  presets,
  selectedCard,
  selectedText,
  newestId,
  onSelect,
  onAdd,
  onDelete,
}: Props) {
  const reduced = useReducedMotion()
  const card = normaliseHex(selectedCard)
  const text = normaliseHex(selectedText)

  // Which captured preset is showing its inline Delete affordance.
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const pressTimer = useRef<number | null>(null)

  // Dismiss the Delete chip on Escape or any tap elsewhere.
  useEffect(() => {
    if (!deletingId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeletingId(null)
    }
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('[data-deletable="true"]')) setDeletingId(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [deletingId])

  const clearTimer = () => {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const spring = { type: 'spring' as const, visualDuration: 0.3, bounce: 0.2 }

  return (
    <div className="preset-row" role="group" aria-label="Colour presets">
      <button
        type="button"
        className="preset-btn"
        aria-label="Add current colours as a preset"
        onClick={onAdd}
      >
        <span className="preset-add">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 4v12M4 10h12" stroke="#F8F9F9" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {presets.map((preset) => {
        const selected =
          normaliseHex(preset.card) === card && normaliseHex(preset.text) === text
        const captured = preset.source === 'captured'
        const showDelete = deletingId === preset.id

        return (
          <motion.div
            key={preset.id}
            className="preset-slot"
            data-deletable={captured ? 'true' : undefined}
            layout={!reduced}
            initial={
              preset.id === newestId && !reduced ? { scale: 0.4, opacity: 0 } : false
            }
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
          >
            <AnimatePresence>
              {showDelete && (
                <motion.button
                  type="button"
                  className="preset-delete"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.9 }}
                  transition={reduced ? { duration: 0.01 } : spring}
                  onClick={() => {
                    onDelete(preset.id)
                    setDeletingId(null)
                  }}
                >
                  Delete
                </motion.button>
              )}
            </AnimatePresence>
            <button
              type="button"
              className="preset-btn"
              data-selected={selected}
              aria-pressed={selected}
              aria-label={
                preset.title ?? `Captured preset, ${preset.card} card with ${preset.text} text`
              }
              onClick={() => onSelect(preset)}
              onContextMenu={
                captured
                  ? (e) => {
                      e.preventDefault()
                      setDeletingId(preset.id)
                    }
                  : undefined
              }
              onPointerDown={
                captured
                  ? () => {
                      clearTimer()
                      pressTimer.current = window.setTimeout(
                        () => setDeletingId(preset.id),
                        LONG_PRESS_MS,
                      )
                    }
                  : undefined
              }
              onPointerUp={captured ? clearTimer : undefined}
              onPointerLeave={captured ? clearTimer : undefined}
            >
              <span
                className="preset-swatch"
                style={{ backgroundColor: preset.card, color: preset.text }}
                aria-hidden="true"
              >
                Aa
              </span>
            </button>
          </motion.div>
        )
      })}
    </div>
  )
}
