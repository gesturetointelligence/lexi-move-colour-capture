// Curated presets (exact dark-mode hexes from the iOS app) + captured-preset helpers.

import type { Preset } from './types'

export const CURATED_PRESETS: Preset[] = [
  { id: 'signal', title: 'Signal', card: '#D0E62C', text: '#151715', source: 'curated' },
  { id: 'signalDark', title: 'Signal Dark', card: '#1C1C1E', text: '#D0E62C', source: 'curated' },
  { id: 'grey', title: 'Grey', card: '#7D827E', text: '#151715', source: 'curated' },
  { id: 'greyDark', title: 'Grey Dark', card: '#1C1C1E', text: '#7D827E', source: 'curated' },
  { id: 'monoLight', title: 'Mono Light', card: '#F8F9F9', text: '#151715', source: 'curated' },
  { id: 'monoDark', title: 'Mono Dark', card: '#1C1C1E', text: '#F8F9F9', source: 'curated' },
  { id: 'blue', title: 'Blue', card: '#2C8AE8', text: '#151715', source: 'curated' },
  { id: 'blueDark', title: 'Blue Dark', card: '#1C1C1E', text: '#2C8AE8', source: 'curated' },
  { id: 'green', title: 'Green', card: '#2CE86A', text: '#151715', source: 'curated' },
  { id: 'greenDark', title: 'Green Dark', card: '#1C1C1E', text: '#30D158', source: 'curated' },
  { id: 'violet', title: 'Violet', card: '#8A2CE8', text: '#F8F9F9', source: 'curated' },
  { id: 'violetDark', title: 'Violet Dark', card: '#1C1C1E', text: '#8A2CE8', source: 'curated' },
  { id: 'pink', title: 'Pink', card: '#E82C8A', text: '#151715', source: 'curated' },
  { id: 'pinkDark', title: 'Pink Dark', card: '#1C1C1E', text: '#E82C8A', source: 'curated' },
  { id: 'orange', title: 'Orange', card: '#E88A2C', text: '#151715', source: 'curated' },
  { id: 'orangeDark', title: 'Orange Dark', card: '#1C1C1E', text: '#FF9F0A', source: 'curated' },
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
 * the captured list and the curated 16. Returns the (possibly unchanged) list
 * and the new preset, or null if it was a duplicate.
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
  return { list: [preset, ...captured], added: preset }
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
