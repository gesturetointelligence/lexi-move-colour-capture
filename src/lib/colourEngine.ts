// Colour Capture engine — pure, deterministic, zero-dependency.
//
// Pipeline: samplePixels (DOM source → RGBA bytes) → extractPalette (MMCQ
// median-cut quantisation, à la color-thief) → generateCombos (card/text pair
// generation + algorithmic scoring). Everything below extractPalette is
// DOM-free and unit-testable in plain Node.

import { defaultTuning } from './types'
import type { RGB, PaletteEntry, Combo, EngineTuning } from './types'

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

const clamp255 = (n: number): number => Math.min(255, Math.max(0, Math.round(n)))

/** Parses `#RRGGBB` (or shorthand `#RGB`, leading `#` optional) into an RGB tuple. */
export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** Formats an RGB tuple as a lowercase `#rrggbb` string. Channels are clamped to 0–255. */
export function rgbToHex(rgb: RGB): string {
  const [r, g, b] = rgb.map(clamp255)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}

/**
 * WCAG 2.x relative luminance of an sRGB colour (0 = black, 1 = white).
 * Uses the spec's exact linearisation: threshold 0.03928, exponent 2.4.
 */
export function relativeLuminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio between two RGB tuples, in [1, 21]. Order-independent. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Linearly mixes `hex` toward `targetHex` by fraction `t` (0 = unchanged,
 * 1 = target) per RGB channel. Returns `#rrggbb`.
 */
export function mixToward(hex: string, targetHex: string, t: number): string {
  const from = hexToRgb(hex)
  const to = hexToRgb(targetHex)
  return rgbToHex([
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ] as RGB)
}

// Derived "inks": near-black / near-white carrying a whisper of the card hue
// (matches Lexi's curated presets, which never use pure #000/#FFF).
const DARK_INK_T = 0.92 // 8% of the card hue survives → L* ≈ 8 for mid cards
const LIGHT_INK_T = 0.94 // → L* ≈ 96

const darkInk = (cardHex: string): string => mixToward(cardHex, '#000000', DARK_INK_T)
const lightInk = (cardHex: string): string => mixToward(cardHex, '#ffffff', LIGHT_INK_T)

/**
 * The better of the two derived inks (hue-tinted near-black / near-white) for
 * an arbitrary card colour — whichever contrasts more against the card.
 * Used by the UI for preset chips' "Aa" label.
 */
export function bestInk(cardHex: string): string {
  const card = hexToRgb(cardHex)
  const dark = darkInk(cardHex)
  const light = lightInk(cardHex)
  return contrastRatio(card, hexToRgb(dark)) >= contrastRatio(card, hexToRgb(light))
    ? dark
    : light
}

/** HSL from RGB: hue in degrees [0, 360), saturation and lightness in [0, 1]. */
function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h *= 60
  if (h < 0) h += 360
  return [h, s, l]
}

/** Circular hue distance in degrees, in [0, 180]. */
const hueDistance = (h1: number, h2: number): number => {
  const d = Math.abs(h1 - h2) % 360
  return d > 180 ? 360 - d : d
}

/** Euclidean distance in raw RGB space (simple ΔE proxy, max ≈ 441). */
const rgbDistance = (a: RGB, b: RGB): number =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

// ---------------------------------------------------------------------------
// samplePixels — DOM source → packed RGBA bytes
// ---------------------------------------------------------------------------

/**
 * Draws `source` onto an offscreen canvas downscaled so total pixels ≈
 * `maxSamples`, and returns the packed RGBA data. Pixels with alpha < 125 are
 * skipped; near-white pixels (r, g, b all > 250) are skipped only for
 * HTMLImageElement sources (photo-library white borders — same trade-off as
 * color-thief). Returns an empty array for 0-dimension sources or when no 2D
 * context is available; never throws for those cases.
 */
export function samplePixels(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  maxSamples = 10000,
): Uint8ClampedArray {
  const isVideo = typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement
  const isImage = typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement

  const width = isVideo
    ? (source as HTMLVideoElement).videoWidth
    : isImage
      ? (source as HTMLImageElement).naturalWidth
      : (source as HTMLCanvasElement | ImageBitmap).width
  const height = isVideo
    ? (source as HTMLVideoElement).videoHeight
    : isImage
      ? (source as HTMLImageElement).naturalHeight
      : (source as HTMLCanvasElement | ImageBitmap).height

  if (!width || !height || maxSamples <= 0) return new Uint8ClampedArray(0)

  const scale = Math.min(1, Math.sqrt(maxSamples / (width * height)))
  const tw = Math.max(1, Math.round(width * scale))
  const th = Math.max(1, Math.round(height * scale))

  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null
  if (typeof OffscreenCanvas !== 'undefined') {
    ctx = new OffscreenCanvas(tw, th).getContext('2d', { willReadFrequently: true })
  } else if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  }
  if (!ctx) return new Uint8ClampedArray(0)

  let data: Uint8ClampedArray
  try {
    ctx.drawImage(source as CanvasImageSource, 0, 0, tw, th)
    data = ctx.getImageData(0, 0, tw, th).data
  } catch {
    return new Uint8ClampedArray(0) // e.g. video with no frame yet, tainted canvas
  }

  // Filter into a packed RGBA array.
  const out = new Uint8ClampedArray(data.length)
  let n = 0
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 125) continue
    if (isImage && r > 250 && g > 250 && b > 250) continue
    out[n] = r
    out[n + 1] = g
    out[n + 2] = b
    out[n + 3] = a
    n += 4
  }
  return out.slice(0, n)
}

// ---------------------------------------------------------------------------
// extractPalette — MMCQ median-cut quantisation (color-thief style)
// ---------------------------------------------------------------------------

const SIGBITS = 5
const RSHIFT = 8 - SIGBITS
const MULT = 1 << RSHIFT
const HISTO_SIZE = 1 << (SIGBITS * 3)
const FRACT_BY_POPULATION = 0.75 // MMCQ's two-phase split ratio
const MAX_ITERATIONS = 1000

const histoIndex = (r: number, g: number, b: number): number =>
  (r << (2 * SIGBITS)) | (g << SIGBITS) | b

/** A 3D box in 5-bit-per-channel colour space (MMCQ's vbox). */
class VBox {
  private cachedCount = -1

  constructor(
    public lo: [number, number, number],
    public hi: [number, number, number],
    private histo: Uint32Array,
  ) {}

  clone(): VBox {
    return new VBox([...this.lo], [...this.hi], this.histo)
  }

  get volume(): number {
    return (
      (this.hi[0] - this.lo[0] + 1) *
      (this.hi[1] - this.lo[1] + 1) *
      (this.hi[2] - this.lo[2] + 1)
    )
  }

  get count(): number {
    if (this.cachedCount >= 0) return this.cachedCount
    let n = 0
    for (let r = this.lo[0]; r <= this.hi[0]; r++)
      for (let g = this.lo[1]; g <= this.hi[1]; g++)
        for (let b = this.lo[2]; b <= this.hi[2]; b++) n += this.histo[histoIndex(r, g, b)]
    this.cachedCount = n
    return n
  }

  /** Shrinks bounds to the tight extent of non-zero histogram cells. */
  tighten(): this {
    const max = (1 << SIGBITS) - 1
    const lo: [number, number, number] = [max, max, max]
    const hi: [number, number, number] = [0, 0, 0]
    let any = false
    for (let r = this.lo[0]; r <= this.hi[0]; r++)
      for (let g = this.lo[1]; g <= this.hi[1]; g++)
        for (let b = this.lo[2]; b <= this.hi[2]; b++) {
          if (this.histo[histoIndex(r, g, b)] === 0) continue
          any = true
          if (r < lo[0]) lo[0] = r
          if (g < lo[1]) lo[1] = g
          if (b < lo[2]) lo[2] = b
          if (r > hi[0]) hi[0] = r
          if (g > hi[1]) hi[1] = g
          if (b > hi[2]) hi[2] = b
        }
    if (any) {
      this.lo = lo
      this.hi = hi
    }
    return this
  }

  /** Histogram-weighted average colour of the box, in 8-bit RGB. */
  avg(): RGB {
    let total = 0
    let rSum = 0
    let gSum = 0
    let bSum = 0
    for (let r = this.lo[0]; r <= this.hi[0]; r++)
      for (let g = this.lo[1]; g <= this.hi[1]; g++)
        for (let b = this.lo[2]; b <= this.hi[2]; b++) {
          const h = this.histo[histoIndex(r, g, b)]
          if (!h) continue
          total += h
          rSum += h * (r + 0.5) * MULT
          gSum += h * (g + 0.5) * MULT
          bSum += h * (b + 0.5) * MULT
        }
    if (total === 0) {
      return [
        clamp255((MULT * (this.lo[0] + this.hi[0] + 1)) / 2),
        clamp255((MULT * (this.lo[1] + this.hi[1] + 1)) / 2),
        clamp255((MULT * (this.lo[2] + this.hi[2] + 1)) / 2),
      ]
    }
    return [clamp255(rSum / total), clamp255(gSum / total), clamp255(bSum / total)]
  }
}

/**
 * Splits a vbox at the population median of its longest axis (MMCQ's doCut,
 * including the left/right cut-point adjustment). Returns two boxes, one box
 * when unsplittable (single cell), or [] when empty.
 */
function medianCutApply(histo: Uint32Array, vbox: VBox): VBox[] {
  const total = vbox.count
  if (total === 0) return []

  const widths = [
    vbox.hi[0] - vbox.lo[0] + 1,
    vbox.hi[1] - vbox.lo[1] + 1,
    vbox.hi[2] - vbox.lo[2] + 1,
  ]
  const maxw = Math.max(widths[0], widths[1], widths[2])
  if (maxw === 1) return [vbox.clone()] // single cell — cannot split

  const axis = widths[0] === maxw ? 0 : widths[1] === maxw ? 1 : 2
  const a1 = vbox.lo[axis]
  const a2 = vbox.hi[axis]

  // Population summed per coordinate along the chosen axis, then prefix-summed.
  const partial = new Array<number>(a2 + 1).fill(0)
  for (let r = vbox.lo[0]; r <= vbox.hi[0]; r++)
    for (let g = vbox.lo[1]; g <= vbox.hi[1]; g++)
      for (let b = vbox.lo[2]; b <= vbox.hi[2]; b++) {
        const coord = axis === 0 ? r : axis === 1 ? g : b
        partial[coord] += histo[histoIndex(r, g, b)]
      }
  let running = 0
  for (let i = a1; i <= a2; i++) {
    running += partial[i]
    partial[i] = running
  }

  for (let i = a1; i <= a2; i++) {
    if (partial[i] <= total / 2) continue
    const left = i - a1
    const right = a2 - i
    let d =
      left <= right
        ? Math.min(a2 - 1, Math.floor(i + right / 2))
        : Math.max(a1, Math.floor(i - 1 - left / 2))
    while (d < a2 && partial[d] === 0) d++
    while (d > a1 && total - partial[d] === 0 && partial[d - 1] > 0) d--
    const hi1: [number, number, number] = [...vbox.hi]
    hi1[axis] = d
    const lo2: [number, number, number] = [...vbox.lo]
    lo2[axis] = d + 1
    const box1 = new VBox([...vbox.lo], hi1, histo).tighten()
    const box2 = new VBox(lo2, [...vbox.hi], histo).tighten()
    return [box1, box2].filter((b) => b.count > 0)
  }
  return [vbox.clone()]
}

/**
 * Quantises packed RGBA pixel data into a palette of at most `colorCount`
 * dominant colours using median-cut (MMCQ, color-thief style): a 5-bit-per-
 * channel histogram, then recursive median cuts — the first 75% of splits
 * ranked by population, the remainder by population × volume. Pixels with
 * alpha < 125 are ignored. Result is sorted by population, descending.
 * Returns [] for empty input.
 */
export function extractPalette(pixels: Uint8ClampedArray, colorCount = 12): PaletteEntry[] {
  if (pixels.length < 4 || colorCount < 1) return []

  const histo = new Uint32Array(HISTO_SIZE)
  let any = false
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 125) continue
    histo[
      histoIndex(pixels[i] >> RSHIFT, pixels[i + 1] >> RSHIFT, pixels[i + 2] >> RSHIFT)
    ]++
    any = true
  }
  if (!any) return []

  const full = new VBox([0, 0, 0], [(1 << SIGBITS) - 1, (1 << SIGBITS) - 1, (1 << SIGBITS) - 1], histo)
  const queue: VBox[] = [full.tighten()]
  const done: VBox[] = []

  const byCount = (a: VBox, b: VBox) => a.count - b.count
  const byCountTimesVolume = (a: VBox, b: VBox) => a.count * a.volume - b.count * b.volume

  const iterate = (cmp: (a: VBox, b: VBox) => number, target: number): void => {
    let iters = 0
    while (queue.length > 0 && queue.length + done.length < target && iters++ < MAX_ITERATIONS) {
      queue.sort(cmp)
      const vbox = queue.pop()!
      const split = medianCutApply(histo, vbox)
      if (split.length < 2) {
        if (split.length === 1) done.push(split[0])
        continue
      }
      queue.push(split[0], split[1])
    }
  }

  iterate(byCount, Math.ceil(FRACT_BY_POPULATION * colorCount))
  iterate(byCountTimesVolume, colorCount)

  return [...queue, ...done]
    .filter((box) => box.count > 0)
    .map((box) => {
      const rgb = box.avg()
      return { rgb, hex: rgbToHex(rgb), population: box.count }
    })
    .sort((a, b) => b.population - a.population || a.hex.localeCompare(b.hex))
}

// ---------------------------------------------------------------------------
// generateCombos — candidate pairs, scoring, diversity, guaranteed count
// ---------------------------------------------------------------------------

interface Candidate extends Combo {
  cardRgb: RGB
  textRgb: RGB
  contrast: number
}

const pairKey = (card: string, text: string): string => `${card}|${text}`

/** Contrast score: peaks at idealContrast, mild penalty toward both extremes. */
const contrastScore = (contrast: number, ideal: number): number => {
  const d = (contrast - ideal) / ideal
  return 1 / (1 + d * d)
}

/** Chroma reward via HSL: true chroma (1 − |2L − 1|) · S, with a mud penalty for desaturated mid-greys. */
const chromaMetric = (rgb: RGB): number => {
  const [, s, l] = rgbToHsl(rgb)
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const mud = chroma < 0.08 && l > 0.2 && l < 0.8 ? 0.15 : 0
  return chroma - mud
}

function scorePair(
  cardRgb: RGB,
  textRgb: RGB,
  contrast: number,
  cardPopulation: number,
  totalPopulation: number,
  bothPalette: boolean,
  tuning: EngineTuning,
): number {
  let score = contrastScore(contrast, tuning.idealContrast)
  score += tuning.popWeight * Math.sqrt(totalPopulation > 0 ? cardPopulation / totalPopulation : 0)
  score += tuning.chromaWeight * chromaMetric(cardRgb)
  if (bothPalette) {
    const [hCard, sCard] = rgbToHsl(cardRgb)
    const [hText, sText] = rgbToHsl(textRgb)
    if (sCard >= 0.15 && sText >= 0.15) {
      const d = hueDistance(hCard, hText)
      if (d < 40 || d >= 150) score += tuning.harmonyWeight // analogous / complementary
    }
  }
  return score
}

/** Deterministic best-first ordering: score desc, then hex strings as tiebreak. */
const byScoreDesc = (a: Candidate, b: Candidate): number =>
  b.score - a.score || a.card.localeCompare(b.card) || a.text.localeCompare(b.text)

/** Text polarity: true when the text is lighter than the card (light-on-dark). */
const isLightOnDark = (c: Candidate): boolean =>
  relativeLuminance(c.textRgb) > relativeLuminance(c.cardRgb)

/**
 * Generates exactly `count` scored card/text colour combos from a palette,
 * sorted best-first.
 *
 * Candidates are every ordered palette pair plus, per palette colour, two
 * derived hue-tinted inks (near-black and near-white). Scoring combines a
 * WCAG contrast gate/curve, card-population dominance, chroma reward, and
 * hue harmony — all weights come from `tuning`. A greedy diversity pass keeps
 * the selection visually distinct (card colours at least
 * `tuning.diversityDistance` apart in RGB unless text polarity differs).
 *
 * The count is guaranteed: the diversity threshold relaxes progressively on
 * sparse palettes, and monochrome input is padded with derived-ink pairs
 * (lowering the contrast gate for padding only if even those cannot clear
 * it). Returns [] only for an empty palette.
 */
export function generateCombos(
  palette: PaletteEntry[],
  count = 8,
  tuning: EngineTuning = defaultTuning,
): Combo[] {
  if (palette.length === 0 || count < 1) return []

  const totalPopulation = palette.reduce((sum, p) => sum + p.population, 0)

  const makeCandidate = (
    cardHex: string,
    textHex: string,
    cardPopulation: number,
    bothPalette: boolean,
  ): Candidate => {
    const cardRgb = hexToRgb(cardHex)
    const textRgb = hexToRgb(textHex)
    const contrast = contrastRatio(cardRgb, textRgb)
    return {
      card: cardHex,
      text: textHex,
      score: scorePair(cardRgb, textRgb, contrast, cardPopulation, totalPopulation, bothPalette, tuning),
      cardRgb,
      textRgb,
      contrast,
    }
  }

  // --- Candidate pool: ordered palette pairs + derived inks per colour. ---
  const seen = new Set<string>()
  const candidates: Candidate[] = []
  const addCandidate = (c: Candidate): void => {
    const key = pairKey(c.card, c.text)
    if (seen.has(key) || c.card === c.text) return
    seen.add(key)
    candidates.push(c)
  }

  for (const a of palette) {
    for (const b of palette) {
      if (a === b) continue
      addCandidate(makeCandidate(a.hex, b.hex, a.population, true))
    }
    addCandidate(makeCandidate(a.hex, darkInk(a.hex), a.population, false))
    addCandidate(makeCandidate(a.hex, lightInk(a.hex), a.population, false))
  }

  const gated = candidates.filter((c) => c.contrast >= tuning.minContrast).sort(byScoreDesc)

  // --- Greedy diversity selection, relaxing the threshold until count met. ---
  let selected: Candidate[] = []
  for (const relax of [1, 0.5, 0.25, 0]) {
    const distance = tuning.diversityDistance * relax
    const picked: Candidate[] = []
    for (const c of gated) {
      if (picked.length >= count) break
      const clash = picked.some(
        (p) =>
          rgbDistance(p.cardRgb, c.cardRgb) < distance &&
          isLightOnDark(p) === isLightOnDark(c),
      )
      if (!clash) picked.push(c)
    }
    selected = picked
    if (selected.length >= count) break
  }

  // --- Padding: derived-ink pairs guarantee the count on monochrome input. ---
  if (selected.length < count) {
    const selectedKeys = new Set(selected.map((c) => pairKey(c.card, c.text)))
    const mixes = [DARK_INK_T, 1, 0.85, 0.78, 0.7, 0.6, 0.5]
    // Progressively lower the gate for padding only; ratio 1 always passes.
    for (const gate of [tuning.minContrast, tuning.minContrast * 0.75, tuning.minContrast * 0.5, 1]) {
      for (const entry of palette) {
        for (const t of mixes) {
          const dark = mixToward(entry.hex, '#000000', t)
          const light = mixToward(entry.hex, '#ffffff', t)
          const pairs: Array<[string, string]> = [
            [entry.hex, dark],
            [entry.hex, light],
            [dark, light],
            [light, dark],
            [dark, entry.hex],
            [light, entry.hex],
          ]
          for (const [card, text] of pairs) {
            if (selected.length >= count) break
            if (card === text || selectedKeys.has(pairKey(card, text))) continue
            const c = makeCandidate(card, text, card === entry.hex ? entry.population : 0, false)
            if (c.contrast < gate) continue
            selectedKeys.add(pairKey(card, text))
            selected.push(c)
          }
        }
      }
      if (selected.length >= count) break
    }
    // Absolute last resort (pathological counts): synthesised grey-ramp pairs.
    for (let k = 0; selected.length < count && k < count * 4; k++) {
      const card = mixToward('#000000', '#ffffff', (k + 1) / (count * 4 + 1))
      const text = k % 2 === 0 ? '#ffffff' : '#000000'
      if (selectedKeys.has(pairKey(card, text))) continue
      selectedKeys.add(pairKey(card, text))
      selected.push(makeCandidate(card, text, 0, false))
    }
  }

  return selected
    .sort(byScoreDesc)
    .slice(0, count)
    .map(({ card, text, score }) => ({ card, text, score }))
}
