# Prompt: Colour Capture in Lexi Magic (Themes screen)

> Paste everything below this line into a Claude Code session opened at the lexi-magic monorepo root.

---

Implement **Colour Capture** on the Themes screen of Magic (`apps/magic-mobile`). This ships a pattern already validated in the web prototype `gesturetointelligence/lexi-move-colour-capture` (local checkout: `~/Projects/lexi-move-colour-capture`) — treat that repo as the source of truth for the algorithm and interaction design. Read its `src/lib/colourEngine.ts`, `src/lib/types.ts`, and `src/App.tsx` before writing any code.

## What ships (three additions, nothing else changes)

The Themes screen is `apps/magic-mobile/app/settings/app/theme.tsx`; theme data and colour maths live in `apps/magic-mobile/lib/app-themes.ts`; persisted state in `components/LocalPreferencesContext.tsx`.

1. **(+) add-preset button** leading the COLOURS row — position 0, before the first curated swatch. Same 54pt-circle-in-64pt-ring slot as the presets, 1px dashed `separator` border, `secondarySystemGroupedBackground` fill, white SF Symbol `plus`. Tapping it saves the CURRENT `{cardColor, textColor}` as a captured preset: prepended after the (+), before curated presets; dedup against both captured and curated (an exact pair match selects the existing swatch instead of adding); persists across launches. Captured swatches render like curated ones (card fill, "Aa" in text colour) and select on tap. Long-press on a captured preset offers Delete via context menu (follow the existing card long-press menu pattern).
2. **Capture row** appended inside the existing Card/Text grouped section, below the Text row, separated by the standard inset hairline: a full-width 56pt tappable row with a single centred SF Symbol `eyedropper` (white, regular weight) — no label, button-like highlight on press. Tapping presents the **capture sheet**.
3. **Explore loop on the preview card.** After any capture, the "hello, world." preview card becomes tappable: each tap advances through the 8 generated combos on a loop (8 → 1), applying `cardColor`/`textColor` (raw hex — both fields already accept hex per `isHexColor`). Affordances: a small blurred pill top-right inside the card reading "Tap to explore · n/8", a row of 8 dots under the card (active dot = combo text colour, falling back to white when its luminance is near-black), a one-shot gentle scale pulse when combos first arrive, and a 0.98 press-scale spring on tap. Explore state is session-only (not persisted); the applied colours persist as normal preferences. The (+) button pins whichever combo is showing.

### The capture sheet

- Native-feeling sheet/full-screen cover, black background: title row ("Camera"), × close; a radius-24 viewfinder (3:4, content cover); a **live palette strip** under the viewfinder — the current frame is sampled every ~400 ms and the extracted palette renders as a row of small circles with subtle layout animation; a white pill **Capture** shutter; beside it a 44pt circular **photo library** button (SF Symbol `photo.on.rectangle`).
- Library button → system photo picker (PHPicker via `expo-image-picker`, no full library permission). A chosen photo replaces the viewfinder (shutter label becomes "Use photo"), palette computed once.
- Shutter → freeze frame, run the full pipeline, dismiss, apply combo 1, arm explore mode.
- Camera permission denied → message inside the viewfinder with a Settings deep-link. Always stop/release the camera on dismiss.

## The engine (port, don't reinvent)

Port `src/lib/colourEngine.ts` from the prototype **verbatim in behaviour** — everything below `samplePixels` is pure TypeScript with zero dependencies and runs unchanged in RN. Do not substitute a library (no color-thief npm, no AI, no network). It must stay deterministic: same pixels + same tuning → same 8 combos.

Pipeline: `samplePixels` (≈40k RGBA samples from a downscaled frame) → `extractPalette` (MMCQ median-cut, 5-bit histogram, two-phase split: 75% by population then population×volume, boxes tightened to data bounds) → `generateCombos(palette, 8, tuning)`.

`generateCombos` internals that must survive the port exactly:
- Candidates: every ordered palette pair + per-colour derived inks (hue-tinted near-black `mixToward(card, #000, 0.92)` and near-white `mixToward(card, #fff, 0.94)`).
- Scoring: asymmetric contrast bell around `idealContrast` (shortfall weighted 2.5× vs overshoot), `popWeight·sqrt(pop/total)` dominance for the card slot, HSL-chroma reward with mid-grey mud penalty, hue-harmony bonus (analogous < 40° or complementary 150–210°, both colours saturation ≥ 0.15, palette pairs only).
- Gates before selection: user `minContrast` AND a fixed legibility criterion — a pair passes if WCAG contrast ≥ 1.8 **or** OKLab ΔE×400 ≥ 100 (WCAG alone underestimates chromatic legibility; without this gate the harmony bonus promotes unreadable same-hue tone-on-tone pairs).
- Selection: greedy **max-min** — each pick maximises `score + (diversityDistance/100)·min(distToPicked, 220)/100`… (copy the exact expression from source), where combo distance = OKLab ΔE×400 of cards + 0.4× that of texts; card hexes never repeat while avoidable; each reuse of a text colour costs a flat 1.2 penalty. **Not** a distance threshold — thresholds silently degrade to score order (we hit this; see prototype git history).
- Always returns exactly 8 (derived-ink padding on monochrome input), sorted best-first.

Default tuning (Ravi + Wayne's locked judging — ship these exactly):
`{ colorCount: 8, maxSamples: 40000, minContrast: 1, idealContrast: 4.5, popWeight: 0.5, chromaWeight: 3, harmonyWeight: 3, diversityDistance: 200 }`

**Pixel access** is the only genuinely native piece: you need RGBA bytes from (a) a live camera frame ~every 400 ms and (b) a picked photo, downscaled to ≈ `maxSamples` pixels. Investigate what the repo already supports before adding dependencies — candidates: `expo-camera` frame capture + `expo-image-manipulator` resize with `@shopify/react-native-skia` `Image.readPixels` for decode, or a VisionKit/AVFoundation route if a native module already exists. A new native dependency is acceptable (precedent: `react-native-view-shot` was added for card sharing) but call it out in the PR. Live sampling must not jank the sheet — do the extraction off the JS-render critical path (InteractionManager, a worklet, or chunked) and measure.

## State

Extend `StoredLocalPreferences` with `capturedPresets?: Array<{ id: string; card: string; text: string }>` (hex pairs). Validate on read (regex the hexes, drop malformed entries); malformed or missing → `[]`. Follow the existing preferences read/write patterns in `LocalPreferencesContext` — do not invent a parallel store.

## Constraints

- Untouched: FONTS and ICONS sections, the native ColorPicker Card/Text rows, curated preset data/order, Bold = weight 600.
- All maths algorithmic — no AI, no network calls, works offline.
- Reduced Motion honoured on every new animation; VoiceOver labels on the (+), capture row, sheet controls, and the explore card (announce "combo n of 8").
- PostHog events matching the existing snake_case style: `colour_captured` (props: `source: "camera" | "library"`), `combo_explored` (`index`), `colour_preset_added`, `colour_preset_deleted`.
- No DialKit / tuning UI in-app — defaults are final (the web move remains the tuning rig).
- Locale: the COLOURS header logic already exists; don't touch it.

## Acceptance

1. Unit tests for the engine port (pure functions, no native): 3-colour synthetic input recovers the colours and yields 8 combos sorted best-first; monochrome input still yields exactly 8; `contrastRatio(#FFF, #000) === 21`; determinism (two runs, deep-equal); no card hex repeated and no text hex used more than twice for an 8-colour palette; every returned combo passes contrast ≥ 1.8 or ΔE×400 ≥ 100.
2. Device pass (both test iPhones): camera capture in mixed light → 8 visibly distinct combos; photo-library path; permission-denied path shows the recovery message; explore loop cycles 1→8→1 with one advance per tap; (+) pins the current combo, dedup works, captured presets survive relaunch; long-press delete works.
3. Cross-check: run the same photo through the web move (`npm run dev` in `~/Projects/lexi-move-colour-capture`) — the 8 combos must match the app's output exactly (same hexes, same order). This is the port-correctness oracle.
4. New gestures/animations verified in a **Release** build before merge (Fabric/worklet feel-pass — house rule).

Work on a branch, keep the engine in its own file (`lib/colour-capture.ts` or similar) mirroring the prototype's structure, and note any intentional deviation from the prototype in the PR description with the reason.
