import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { DialRoot, DialStore } from 'dialkit'
import 'dialkit/styles.css'

import { generateCombos } from './lib/colourEngine'
import { defaultTuning } from './lib/types'
import type { Combo, EngineTuning, PaletteEntry, Preset } from './lib/types'
import { CURATED_PRESETS, addCapturedPreset } from './lib/presets'
import { useLocalStorage } from './hooks/useLocalStorage'

import { PreviewCard } from './components/PreviewCard'
import { PresetsRow } from './components/PresetsRow'
import { Controls } from './components/Controls'
import { CaptureOverlay } from './components/CaptureOverlay'

// ---- Persisted state (versioned) ----

interface PersistedState {
  version: 2
  card: string
  text: string
  capturedPresets: Preset[]
}

const STORAGE_KEY = 'colour-capture-state'

// Signal default: signal card, near-black ink.
const DEFAULT_CARD = '#D0E62C'
const DEFAULT_TEXT = '#151715'

const DEFAULT_PERSISTED: PersistedState = {
  version: 2,
  card: DEFAULT_CARD,
  text: DEFAULT_TEXT,
  capturedPresets: [],
}

const HEX = /^#[0-9a-fA-F]{6}$/

function cleanPresets(raw: unknown): Preset[] {
  return Array.isArray(raw)
    ? raw.filter(
        (p): p is Preset =>
          typeof p === 'object' &&
          p !== null &&
          typeof (p as Preset).id === 'string' &&
          HEX.test(String((p as Preset).card)) &&
          HEX.test(String((p as Preset).text)),
      )
    : []
}

function validatePersisted(raw: unknown): PersistedState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>

  // v2 — current shape.
  if (obj.version === 2) {
    return {
      version: 2,
      card: HEX.test(String(obj.card)) ? (obj.card as string) : DEFAULT_CARD,
      text: HEX.test(String(obj.text)) ? (obj.text as string) : DEFAULT_TEXT,
      capturedPresets: cleanPresets(obj.capturedPresets),
    }
  }

  // v1 — migrate: lift theme.cardColor/textColor, drop font fields.
  if (obj.version === 1) {
    const t = (obj.theme ?? {}) as Record<string, unknown>
    return {
      version: 2,
      card: HEX.test(String(t.cardColor)) ? (t.cardColor as string) : DEFAULT_CARD,
      text: HEX.test(String(t.textColor)) ? (t.textColor as string) : DEFAULT_TEXT,
      capturedPresets: cleanPresets(obj.capturedPresets),
    }
  }

  return null
}

// ---- DialKit panel ----

const PANEL_ID = 'colour-capture'

type OverlayState = { mode: 'camera' } | { mode: 'photo'; src: string } | null

export default function App() {
  const [persisted, setPersisted] = useLocalStorage<PersistedState>(
    STORAGE_KEY,
    DEFAULT_PERSISTED,
    validatePersisted,
  )
  const { card, text, capturedPresets } = persisted

  const setColours = useCallback(
    (patch: { card?: string; text?: string }) => {
      setPersisted((p) => ({ ...p, ...patch }))
    },
    [setPersisted],
  )

  // Explore state (in-memory; the chosen colours are what persist).
  const [combos, setCombos] = useState<Combo[] | null>(null)
  const [comboIndex, setComboIndex] = useState(0)
  const [captureCount, setCaptureCount] = useState(0)
  const [newestPresetId, setNewestPresetId] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<OverlayState>(null)

  const paletteRef = useRef<PaletteEntry[] | null>(null)
  const [tuning, setTuning] = useState<EngineTuning>(defaultTuning)
  const tuningRef = useRef(tuning)
  tuningRef.current = tuning

  const applyCombos = useCallback(
    (list: Combo[]) => {
      if (!list.length) return
      setCombos(list)
      setComboIndex(0)
      setColours({ card: list[0].card, text: list[0].text })
    },
    [setColours],
  )

  // Kept in a ref so the DialKit action subscription always sees fresh state.
  const recomputeRef = useRef<() => void>(() => {})
  recomputeRef.current = () => {
    const palette = paletteRef.current
    if (!palette) return
    applyCombos(generateCombos(palette, 8, tuningRef.current))
  }

  // ---- DialKit wiring (register once; guard survives StrictMode re-runs) ----
  const registeredRef = useRef(false)
  const pushingRef = useRef(false)
  useEffect(() => {
    if (registeredRef.current) return
    registeredRef.current = true

    DialStore.registerPanel(PANEL_ID, 'Engine', {
      engine: {
        colorCount: [defaultTuning.colorCount, 4, 24, 1],
        maxSamples: [defaultTuning.maxSamples, 1000, 100000, 1000],
      },
      scoring: {
        minContrast: [defaultTuning.minContrast, 1, 10, 0.1],
        idealContrast: [defaultTuning.idealContrast, 4.5, 21, 0.5],
        popWeight: [defaultTuning.popWeight, 0, 3, 0.1],
        chromaWeight: [defaultTuning.chromaWeight, 0, 6, 0.1],
        harmonyWeight: [defaultTuning.harmonyWeight, 0, 6, 0.1],
        diversityDistance: [defaultTuning.diversityDistance, 0, 400, 5],
      },
      recompute: { type: 'action', label: 'Recompute combos' },
    })

    const num = (x: unknown, fallback: number) =>
      typeof x === 'number' && Number.isFinite(x) ? x : fallback

    DialStore.subscribe(PANEL_ID, () => {
      if (pushingRef.current) return
      const v = DialStore.getValues(PANEL_ID)
      setTuning({
        colorCount: num(v['engine.colorCount'], defaultTuning.colorCount),
        maxSamples: num(v['engine.maxSamples'], defaultTuning.maxSamples),
        minContrast: num(v['scoring.minContrast'], defaultTuning.minContrast),
        idealContrast: num(v['scoring.idealContrast'], defaultTuning.idealContrast),
        popWeight: num(v['scoring.popWeight'], defaultTuning.popWeight),
        chromaWeight: num(v['scoring.chromaWeight'], defaultTuning.chromaWeight),
        harmonyWeight: num(v['scoring.harmonyWeight'], defaultTuning.harmonyWeight),
        diversityDistance: num(v['scoring.diversityDistance'], defaultTuning.diversityDistance),
      })
    })

    DialStore.subscribeActions(PANEL_ID, (action) => {
      if (action === 'recompute') recomputeRef.current()
    })
  }, [])

  // ---- Handlers ----

  const handleCaptured = useCallback(
    (palette: PaletteEntry[]) => {
      setOverlay(null)
      paletteRef.current = palette
      const generated = generateCombos(palette, 8, tuningRef.current)
      if (generated.length) {
        applyCombos(generated)
        setCaptureCount((n) => n + 1) // triggers the one-shot card pulse
      }
    },
    [applyCombos],
  )

  const handleCardTap = useCallback(() => {
    if (!combos || !combos.length) return
    const next = (comboIndex + 1) % combos.length
    setComboIndex(next)
    setColours({ card: combos[next].card, text: combos[next].text })
  }, [combos, comboIndex, setColours])

  const handleSelectPreset = useCallback(
    (preset: Preset) => {
      setColours({ card: preset.card, text: preset.text })
    },
    [setColours],
  )

  const handleAddPreset = useCallback(() => {
    setPersisted((p) => {
      const { list, added } = addCapturedPreset(p.capturedPresets, p.card, p.text)
      if (!added) return p
      setNewestPresetId(added.id)
      return { ...p, capturedPresets: list }
    })
  }, [setPersisted])

  const handleDeletePreset = useCallback(
    (id: string) => {
      setPersisted((p) => ({
        ...p,
        capturedPresets: p.capturedPresets.filter((preset) => preset.id !== id),
      }))
    },
    [setPersisted],
  )

  const handlePhotoPicked = useCallback((dataUrl: string) => {
    setOverlay({ mode: 'photo', src: dataUrl })
  }, [])

  // ---- Render ----

  return (
    <div className="screen">
      <div className="content">
        <PreviewCard
          cardColor={card}
          textColor={text}
          exploreActive={!!combos && combos.length > 0}
          comboCount={combos?.length ?? 0}
          comboIndex={comboIndex}
          pulseKey={captureCount}
          onTap={handleCardTap}
        />
        <section className="stack">
          <h2 className="section-label">Presets</h2>
          <PresetsRow
            presets={[...capturedPresets, ...CURATED_PRESETS]}
            selectedCard={card}
            selectedText={text}
            newestId={newestPresetId}
            onSelect={handleSelectPreset}
            onAdd={handleAddPreset}
            onDelete={handleDeletePreset}
          />
        </section>
        <section className="stack">
          <h2 className="section-label">Controls</h2>
          <Controls
            cardColor={card}
            textColor={text}
            onCardColor={(hex) => setColours({ card: hex })}
            onTextColor={(hex) => setColours({ text: hex })}
            onOpenCapture={() => setOverlay({ mode: 'camera' })}
          />
        </section>
        <p className="footer-line">colour capture · lexi play</p>
      </div>
      <AnimatePresence>
        {overlay && (
          <CaptureOverlay
            key={overlay.mode}
            mode={overlay.mode}
            photoSrc={overlay.mode === 'photo' ? overlay.src : undefined}
            tuning={tuning}
            onClose={() => setOverlay(null)}
            onCaptured={handleCaptured}
            onPickPhoto={handlePhotoPicked}
          />
        )}
      </AnimatePresence>
      <DialRoot position="top-right" defaultOpen={false} theme="dark" productionEnabled />
    </div>
  )
}
