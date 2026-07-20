// Brand seed presets (Lexi Play colour system) + captured-preset helpers.
// The move is no longer a Magic replica — these five seeds replace Magic's
// curated 16 and are colour-only (no font state).

import type { Preset } from './types'

/** Cap on how many captured presets we retain (oldest dropped). */
export const CAPTURED_CAP = 20

// signal on black, black on signal, white on black, black on white, grey on black
export const CURATED_PRESETS: Preset[] = [
  { id: 'signal-on-black', title: 'Signal on black', card: '#151715', text: '#D0E62C', source: 'curated' },
  { id: 'black-on-signal', title: 'Black on signal', card: '#D0E62C', text: '#151715', source: 'curated' },
  { id: 'white-on-black', title: 'White on black', card: '#151715', text: '#F8F9F9', source: 'curated' },
  { id: 'black-on-white', title: 'Black on white', card: '#F8F9F9', text: '#151715', source: 'curated' },
  { id: 'grey-on-black', title: 'Grey on black', card: '#151715', text: '#7D827E', source: 'curated' },
]

/** Case-insensitive hex normalisation for comparisons. */
export function normaliseHex(hex: string): string {
  return hex.trim().toUpperCase()
}

export function isSamePair(
  a: { card: string; text: string },
  b: { card: string; text: string },
): boolean {
  return (
    normaliseHex(a.card) === normaliseHex(b.card) &&
    normaliseHex(a.text) === normaliseHex(b.text)
  )
}

export function makeCapturedPreset(card: string, text: string): Preset {
  return {
    id: `captured-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    card: normaliseHex(card),
    text: normaliseHex(text),
    source: 'captured',
  }
}

/**
 * Prepend a captured preset, deduping on identical card+text pair against both
 * the captured list and the brand seeds. Returns the (possibly unchanged) list,
 * capped at CAPTURED_CAP with the oldest dropped, and the new preset — or null
 * if it was a duplicate.
 */
export function addCapturedPreset(
  captured: Preset[],
  card: string,
  text: string,
): { list: Preset[]; added: Preset | null } {
  const pair = { card, text }
  if (
    captured.some((p) => isSamePair(p, pair)) ||
    CURATED_PRESETS.some((p) => isSamePair(p, pair))
  ) {
    return { list: captured, added: null }
  }
  const preset = makeCapturedPreset(card, text)
  return { list: [preset, ...captured].slice(0, CAPTURED_CAP), added: preset }
}

/** Coerce any hex-ish string into a value <input type="color"> accepts. */
export function toInputHex(hex: string): string {
  const v = hex.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase()
  }
  return '#000000'
}
