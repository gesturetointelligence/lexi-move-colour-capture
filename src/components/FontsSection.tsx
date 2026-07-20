import { motion, useReducedMotion } from 'motion/react'

export type FontKey = 'sf-pro' | 'sf-pro-rounded' | 'sf-mono'
export type FontWeightKey = 'regular' | 'bold'

export const FONT_OPTIONS: { key: FontKey; label: string; stack: string }[] = [
  {
    key: 'sf-pro',
    label: 'SF Pro',
    stack: "-apple-system, BlinkMacSystemFont, system-ui, 'Helvetica Neue', sans-serif",
  },
  {
    key: 'sf-pro-rounded',
    label: 'SF Pro Rounded',
    stack: "ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  },
  {
    key: 'sf-mono',
    label: 'SF Mono',
    stack: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
  },
]

export function fontStack(key: FontKey): string {
  return (FONT_OPTIONS.find((f) => f.key === key) ?? FONT_OPTIONS[1]).stack
}

/** "Bold" in the app is 600, never 700. */
export function fontWeightValue(weight: FontWeightKey): number {
  return weight === 'bold' ? 600 : 400
}

interface Props {
  font: FontKey
  weight: FontWeightKey
  onFontChange: (font: FontKey) => void
  onWeightChange: (weight: FontWeightKey) => void
}

const WEIGHTS: { key: FontWeightKey; label: string }[] = [
  { key: 'regular', label: 'Regular' },
  { key: 'bold', label: 'Bold' },
]

export function FontsSection({ font, weight, onFontChange, onWeightChange }: Props) {
  const reduced = useReducedMotion()

  return (
    <>
      <div className="h-row" role="group" aria-label="Font family">
        {FONT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className="font-chip"
            style={{ fontFamily: option.stack }}
            data-selected={font === option.key}
            aria-pressed={font === option.key}
            onClick={() => onFontChange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="segmented" role="radiogroup" aria-label="Font weight">
        {WEIGHTS.map((w) => (
          <button
            key={w.key}
            type="button"
            className="segment"
            role="radio"
            aria-checked={weight === w.key}
            onClick={() => onWeightChange(w.key)}
          >
            {weight === w.key && (
              <motion.span
                className="segment-pill"
                layoutId="weight-pill"
                aria-hidden="true"
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: 'spring', visualDuration: 0.3, bounce: 0.2 }
                }
              />
            )}
            <span
              className="segment-label"
              style={{ fontWeight: weight === w.key ? 600 : 400 }}
            >
              {w.label}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
