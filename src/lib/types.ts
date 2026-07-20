// Shared contract between the colour engine and the UI. Do not widen casually —
// both sides build against this file.

export type RGB = [number, number, number]

export interface PaletteEntry {
  rgb: RGB
  hex: string
  population: number
}

export interface Combo {
  card: string // hex #RRGGBB
  text: string // hex #RRGGBB
  score: number
}

export interface EngineTuning {
  colorCount: number // median-cut target palette size (default 12)
  maxSamples: number // pixel sample budget (default 10000)
  minContrast: number // WCAG gate, combos below are rejected (default 4.5)
  idealContrast: number // peak of the contrast score curve (default 10)
  popWeight: number // dominant-colour reward for the card slot (default 1)
  chromaWeight: number // saturation reward / mud penalty (default 1)
  harmonyWeight: number // analogous/complementary bonus (default 0.5)
  diversityDistance: number // min RGB distance between selected card colours (default 60)
}

export const defaultTuning: EngineTuning = {
  colorCount: 12,
  maxSamples: 10000,
  minContrast: 4.5,
  idealContrast: 10,
  popWeight: 1,
  chromaWeight: 1,
  harmonyWeight: 0.5,
  diversityDistance: 60,
}

export interface Preset {
  id: string
  card: string // hex
  text: string // hex
  source: 'curated' | 'captured'
  title?: string
}
