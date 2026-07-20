import { useState } from 'react'

interface IconOption {
  key: string
  title: string
  seed: string
  glyph: string
}

const ICON_OPTIONS: IconOption[] = [
  { key: 'signal', title: 'Signal', seed: '#D0E62C', glyph: '#151715' },
  { key: 'signalDark', title: 'Signal Dark', seed: '#151715', glyph: '#D0E62C' },
  { key: 'grey', title: 'Grey', seed: '#7D827E', glyph: '#151715' },
  { key: 'greyDark', title: 'Grey Dark', seed: '#151715', glyph: '#7D827E' },
  { key: 'monoLight', title: 'Mono Light', seed: '#F8F9F9', glyph: '#151715' },
  { key: 'monoDark', title: 'Mono Dark', seed: '#151715', glyph: '#F8F9F9' },
  { key: 'blue', title: 'Blue', seed: '#2C8AE8', glyph: '#151715' },
  { key: 'blueDark', title: 'Blue Dark', seed: '#151715', glyph: '#2C8AE8' },
  { key: 'green', title: 'Green', seed: '#2CE86A', glyph: '#151715' },
  { key: 'greenDark', title: 'Green Dark', seed: '#151715', glyph: '#2CE86A' },
  { key: 'violet', title: 'Violet', seed: '#8A2CE8', glyph: '#F8F9F9' },
  { key: 'violetDark', title: 'Violet Dark', seed: '#151715', glyph: '#8A2CE8' },
  { key: 'pink', title: 'Pink', seed: '#E82C8A', glyph: '#151715' },
  { key: 'pinkDark', title: 'Pink Dark', seed: '#151715', glyph: '#E82C8A' },
  { key: 'orange', title: 'Orange', seed: '#E88A2C', glyph: '#151715' },
  { key: 'orangeDark', title: 'Orange Dark', seed: '#151715', glyph: '#E88A2C' },
]

/** blend(seed → white, amount) for the squircle gradient top stop. */
function blendToWhite(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  const r = mix((n >> 16) & 0xff)
  const g = mix((n >> 8) & 0xff)
  const b = mix(n & 0xff)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** The app logomark: two overlapping rounded squares, back one semi-transparent. */
function Logomark({ colour }: { colour: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="7.5" y="2.5" width="18" height="18" rx="5" fill={colour} opacity="0.45" />
      <rect x="2.5" y="7.5" width="18" height="18" rx="5" fill={colour} />
    </svg>
  )
}

export function IconsRow() {
  const [selected, setSelected] = useState('signal')

  return (
    <div className="h-row" role="group" aria-label="App icon">
      {ICON_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          className="icon-ring"
          data-selected={selected === option.key}
          aria-pressed={selected === option.key}
          aria-label={`${option.title} icon`}
          onClick={() => setSelected(option.key)}
        >
          <span
            className="icon-squircle"
            style={{
              background: `linear-gradient(180deg, ${blendToWhite(option.seed, 0.28)}, ${option.seed})`,
            }}
            aria-hidden="true"
          >
            <Logomark colour={option.glyph} />
          </span>
        </button>
      ))}
    </div>
  )
}
