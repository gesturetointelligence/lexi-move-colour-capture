import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { DialRoot, DialStore } from 'dialkit'
import 'dialkit/styles.css'

import { generateCombos } from './lib/colourEngine'
import { defaultTuning } from './lib/types'
import type { Combo, EngineTuning, PaletteEntry, Preset } from './lib/types'
import { CURATED_PRESETS, addCapturedPreset } from './lib/presets'
import { useLocalStorage } from './hooks/useLocalStorage'

import { NavHeader } from './components/NavHeader'
import { PreviewCard } from './components/PreviewCard'
import { PresetsRow } from './components/PresetsRow'
import { CustomGroup } from './components/CustomGroup'
import { CaptureOverlay } from './components/CaptureOverlay'
import { FontsSection } from './components/FontsSection'
import { IconsRow } from './components/IconsRow'
import type { FontKey, FontWeightKey } from './components/FontsSection'

// ---- Persisted state (versioned) ----

export interface ThemeState {
  cardColor: string
  textColor: string
  cardFont: FontKey
  cardFontWeight: FontWeightKey
}

interface PersistedState {
  version: 1
  theme: ThemeState
  capturedPresets: Preset[]
}

const STORAGE_KEY = 'colour-capture-state'

const DEFAULT_THEME: ThemeState = {
  cardColor: '#D0E62C', // Signal
  textColor: '#151715',
  cardFont: 'sf-pro-rounded',
  cardFontWeight: 'bold',
}

const DEFAULT_PERSISTED: PersistedState = {
  version: 1,
  theme: DEFAULT_THEME,
  capturedPresets: [],
}

const FONT_KEYS: FontKey[] = ['sf-pro', 'sf-pro-rounded', 'sf-mono']
const HEX = /^#[0-9a-fA-F]{6}$/

function validatePersisted(raw: unknown): PersistedState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Partial<PersistedState>
  if (obj.version !== 1) return null
  const t = obj.theme
  const theme: ThemeState = {
    cardColor: t && HEX.test(String(t.cardColor)) ? t.cardColor! : DEFAULT_THEME.cardColor,
    textColor: t && HEX.test(String(t.textColor)) ? t.textColor! : DEFAULT_THEME.textColor,
    cardFont:
      t && FONT_KEYS.includes(t.cardFont as FontKey)
        ? (t.cardFont as FontKey)
        : DEFAULT_THEME.cardFont,
    cardFontWeight:
      t && (t.cardFontWeight === 'regular' || t.cardFontWeight === 'bold')
        ? t.cardFontWeight
        : DEFAULT_THEME.cardFontWeight,
  }
  const capturedPresets = Array.isArray(obj.capturedPresets)
    ? obj.capturedPresets.filter(
        (p): p is Preset =>
          typeof p === 'object' &&
          p !== null &&
          typeof p.id === 'string' &&
          HEX.test(String(p.card)) &&
          HEX.test(String(p.text)),
      )
    : []
  return { version: 1, theme, capturedPresets }
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
  const { theme, capturedPresets } = persisted

  const setTheme = useCallback(
    (patch: Partial<ThemeState>) => {
      setPersisted((p) => ({ ...p, theme: { ...p.theme, ...patch } }))
    },
    [setPersisted],
  )

  // Explore state (in-memory; the theme itself is what persists)
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
      setTheme({ cardColor: list[0].card, textColor: list[0].text })
    },
    [setTheme],
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
    setTheme({ cardColor: combos[next].card, textColor: combos[next].text })
  }, [combos, comboIndex, setTheme])

  const handleSelectPreset = useCallback(
    (preset: Preset) => {
      setTheme({ cardColor: preset.card, textColor: preset.text })
    },
    [setTheme],
  )

  const handleAddPreset = useCallback(() => {
    setPersisted((p) => {
      const { list, added } = addCapturedPreset(
        p.capturedPresets,
        p.theme.cardColor,
        p.theme.textColor,
      )
      if (!added) return p
      setNewestPresetId(added.id)
      return { ...p, capturedPresets: list }
    })
  }, [setPersisted])

  const handlePhotoPicked = useCallback((dataUrl: string) => {
    setOverlay({ mode: 'photo', src: dataUrl })
  }, [])

  // ---- Render ----

  return (
    <div className="screen">
      <div className="content">
        <NavHeader />
        <PreviewCard
          theme={theme}
          exploreActive={!!combos && combos.length > 0}
          comboCount={combos?.length ?? 0}
          comboIndex={comboIndex}
          pulseKey={captureCount}
          onTap={handleCardTap}
        />
        <h2 className="section-header">Colours</h2>
        <PresetsRow
          presets={[...capturedPresets, ...CURATED_PRESETS]}
          selectedCard={theme.cardColor}
          selectedText={theme.textColor}
          newestId={newestPresetId}
          onSelect={handleSelectPreset}
          onAdd={handleAddPreset}
        />
        <CustomGroup
          cardColor={theme.cardColor}
          textColor={theme.textColor}
          onCardColor={(hex) => setTheme({ cardColor: hex })}
          onTextColor={(hex) => setTheme({ textColor: hex })}
          onOpenCapture={() => setOverlay({ mode: 'camera' })}
        />
        <h2 className="section-header">Fonts</h2>
        <FontsSection
          font={theme.cardFont}
          weight={theme.cardFontWeight}
          onFontChange={(cardFont) => setTheme({ cardFont })}
          onWeightChange={(cardFontWeight) => setTheme({ cardFontWeight })}
        />
        <h2 className="section-header">Icons</h2>
        <IconsRow />
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
