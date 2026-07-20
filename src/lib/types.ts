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
  diversityDistance: number // min perceptual (OKLab ×400) distance between selected combos (default 60)
}

// Ravi + Wayne's preferred judging, 2026-07-20: gate wide open (aesthetics
// over legibility), moderate-contrast peak, colour-forward, maximum spread.
// Under the max-min selector the distance term is capped, so 200 pushes
// spread hard without ever drowning out score.
export const defaultTuning: EngineTuning = {
  colorCount: 8,
  maxSamples: 40000,
  minContrast: 1,
  idealContrast: 4.5,
  popWeight: 0.5,
  chromaWeight: 3,
  harmonyWeight: 3,
  diversityDistance: 200,
}

export interface Preset {
  id: string
  card: string // hex
  text: string // hex
  source: 'curated' | 'captured'
  title?: string
}
