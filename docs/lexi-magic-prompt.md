# Prompt: Colour Capture in Lexi Magic (Themes screen)

> Paste everything below this line into a Claude Code session opened at the lexi-magic monorepo root.

---

Implement **Colour Capture** on the Themes screen of Magic (`apps/magic-mobile`). The colour engine was validated in the web prototype `gesturetointelligence/lexi-move-colour-capture` (local checkout: `~/Projects/lexi-move-colour-capture`) — that repo is the **source of truth for the algorithm** (port it verbatim; it is also your correctness oracle, see Acceptance). For interaction design, THIS document supersedes the prototype wherever they differ. Read the prototype's `src/lib/colourEngine.ts` and `src/lib/types.ts` before writing any code.

## What ships

The Themes screen is `apps/magic-mobile/app/settings/app/theme.tsx`; theme data and colour maths live in `apps/magic-mobile/lib/app-themes.ts`; persisted state in `components/LocalPreferencesContext.tsx`.

### 1. Section restructure: PRESETS gets its own row

The circular swatch row moves out from under the COLOURS header into its own section. Same visual order as today, new labelling:

- Preview card
- **PRESETS** (section header, same style as the others) — the swatch row: **(+) button first**, then captured presets (newest first), then the curated 16.
- **COLOURS** (header stays) — the grouped Card / Text rows, plus the new **Capture** row (below).
- FONTS, ICONS — untouched.

### 2. The (+) add-preset button and captured presets

- Position 0 of the PRESETS row, before everything: the standard 54pt-circle-in-64pt-ring slot, 1px dashed `separator` border, `secondarySystemGroupedBackground` fill, white SF Symbol `plus`.
- Tapping it captures the CURRENT `{cardColor, textColor, cardFont, cardFontWeight}` as a preset — **colours AND font choice**. Prepended after the (+); persists across launches.
- Dedup: an exact match (all four fields) against an existing captured preset selects that swatch instead of adding. Colour-identical curated presets don't block adding (font may differ).
- **Cap: 20 captured presets.** Adding the 21st drops the oldest captured preset. Curated presets are never dropped.
- Captured swatches render like curated ones — card-colour fill, "Aa" in the text colour — but the "Aa" is set in the preset's **stored font family and weight** (curated swatches keep today's fixed rounded-600 "Aa").
- Tapping a captured preset applies all four fields. Tapping a curated preset applies colours only (today's behaviour).
- **Delete: long-press a captured preset** → iOS context menu with a single destructive "Delete" action (the standard UIMenu pill over a preview, same mechanism as the card long-press menu already in the app). Curated presets get no menu.

### 3. The Capture row

Inside the existing Card/Text grouped section, below the Text row, separated by the standard inset hairline — **matching the Card/Text row layout**: label **"Capture"** on the left (17pt, `label`), SF Symbol `eyedropper` on the right (white, regular weight, sized/positioned like the row accessories). The whole row is one tappable button with the standard row highlight.

Tapping presents the **system photo picker sheet** (PHPicker via `expo-image-picker`, `selectionLimit: 1`, no full-library permission) — the partial-height sheet with the photo grid and its built-in live camera tile, which is how live capture happens too. **Single photo only — do not enable multi-select.** No custom camera viewfinder, no custom capture sheet.

On pick/shoot: run the pipeline on the photo (downscale → `samplePixels` → `extractPalette` → `generateCombos(palette, 8, defaultTuning)`), apply combo 1, arm explore mode. Extraction is a one-shot on a single image — keep it off the render-critical path but there is no live-sampling loop to worry about. If extraction fails (unreadable image), show the standard toast pattern with a plain-language message; never crash.

### 4. Explore loop on the preview card

After a capture, the "hello, world." preview card cycles through the 8 combos:

- **Tap advances** to the next combo (loop 8 → 1); **horizontal swipe on the card also cycles** (left = next, right = previous).
- Affordance: **a row of 8 carousel dots under the card only** — active dot = current combo's text colour, falling back to white when that colour would vanish against the screen background. **No "Tap to explore" pill, no text hint.**
- One subtle scale pulse when combos first arrive; 0.98 press-scale spring on tap. Applying a combo sets `cardColor`/`textColor` as raw hex (both fields already accept hex per `isHexColor`).
- Explore state is **session-only** (dots and cycling gone after leaving the screen); the applied colours persist as normal preferences. The (+) pins whichever combo is showing (with the current font, per §2).

## The engine (port, don't reinvent)

Port `src/lib/colourEngine.ts` from the prototype **verbatim in behaviour** — everything below `samplePixels` is pure TypeScript with zero dependencies and runs unchanged in RN. Do not substitute a library (no color-thief npm, no AI, no network). It must stay deterministic: same pixels + same tuning → same 8 combos.

Pipeline: `samplePixels` (≈40k RGBA samples from a downscaled image) → `extractPalette` (MMCQ median-cut, 5-bit histogram, two-phase split: 75% by population then population×volume, boxes tightened to data bounds) → `generateCombos(palette, 8, tuning)`.

`generateCombos` internals that must survive the port exactly:
- Candidates: every ordered palette pair + per-colour derived inks (hue-tinted near-black `mixToward(card, #000, 0.92)` and near-white `mixToward(card, #fff, 0.94)`).
- Scoring: asymmetric contrast bell around `idealContrast` (shortfall weighted 2.5× vs overshoot), `popWeight·sqrt(pop/total)` dominance for the card slot, HSL-chroma reward with mid-grey mud penalty, hue-harmony bonus (analogous < 40° or complementary 150–210°, both colours saturation ≥ 0.15, palette pairs only).
- Gates before selection: user `minContrast` AND a fixed legibility criterion — a pair passes if WCAG contrast ≥ 1.8 **or** OKLab ΔE×400 ≥ 100 (WCAG alone underestimates chromatic legibility; without this gate the harmony bonus promotes unreadable same-hue tone-on-tone pairs).
- Selection: greedy **max-min** — each pick maximises score plus the diversity term (copy the exact expression from source), where combo distance = OKLab ΔE×400 of cards + 0.4× that of texts, capped at 220; card hexes never repeat while avoidable; each reuse of a text colour costs a flat 1.2 penalty. **Not** a distance threshold — thresholds silently degrade to score order (we hit this; see prototype git history).
- Always returns exactly 8 (derived-ink padding on monochrome input), sorted best-first.

Default tuning (Ravi + Wayne's locked judging — ship these exactly):
`{ colorCount: 8, maxSamples: 40000, minContrast: 1, idealContrast: 4.5, popWeight: 0.5, chromaWeight: 3, harmonyWeight: 3, diversityDistance: 200 }`

**Pixel access** is the only genuinely native piece: RGBA bytes from ONE picked photo, downscaled to ≈ `maxSamples` pixels. Investigate what the repo already supports before adding dependencies — candidates: `expo-image-manipulator` resize + `@shopify/react-native-skia` `Image.readPixels`, or an existing native route. A new native dependency is acceptable (precedent: `react-native-view-shot` was added for card sharing) but call it out in the PR.

## State

Extend `StoredLocalPreferences` with:

```ts
capturedPresets?: Array<{
  id: string
  card: string // #RRGGBB
  text: string // #RRGGBB
  font: string // cardFont key, e.g. "sf-pro-rounded"
  weight: string // "regular" | "bold"
}>
```

Validate on read (regex the hexes, check font/weight against the known keys; drop malformed entries); malformed or missing → `[]`. Enforce the 20-item cap on write. Follow the existing preferences read/write patterns in `LocalPreferencesContext` — do not invent a parallel store.

## Constraints

- Untouched: FONTS and ICONS sections, the native ColorPicker Card/Text rows, curated preset data/order, Bold = weight 600, the locale-aware COLOURS header logic.
- All maths algorithmic — no AI, no network calls, works offline.
- Reduced Motion honoured on every new animation; VoiceOver labels on the (+), Capture row, and the explore card (announce "combo n of 8"); the swipe gesture must not break VoiceOver navigation of the card.
- PostHog: no new discrete events — increment the sitting's `captures` / `combos_explored` / `presets_added` / `presets_deleted` counters per `lexi-magic-posthog/sitting-schema-v2.md` (2026-08-07: Magic measures sittings, not events; a Themes action is a property of the sitting, never its own event).
- No DialKit / tuning UI in-app — defaults are final (the web move remains the tuning rig).

## Acceptance

1. Unit tests for the engine port (pure functions, no native): 3-colour synthetic input recovers the colours and yields 8 combos sorted best-first; monochrome input still yields exactly 8; `contrastRatio(#FFF, #000) === 21`; determinism (two runs, deep-equal); no card hex repeated and no text hex used more than twice for an 8-colour palette; every returned combo passes contrast ≥ 1.8 or ΔE×400 ≥ 100.
2. Device pass (both test iPhones): Capture row opens the system picker (single-select, camera tile works); a photo in mixed light → 8 visibly distinct combos; explore cycles by tap AND swipe, one step per gesture, 1→8→1; dots reflect position with no text pill; (+) pins the current combo including font, dedup works, presets survive relaunch, "Aa" renders in each captured preset's own font; 21st preset drops the oldest; long-press → Delete works and only on captured presets; permission-denied/cancel paths are graceful.
3. Cross-check: run the same photo through the web move (`npm run dev` in `~/Projects/lexi-move-colour-capture`) — the 8 combos must match the app's output exactly (same hexes, same order). This is the port-correctness oracle. (The prototype's capture UI differs from this spec — only the engine output is the oracle.)
4. New gestures/animations verified in a **Release** build before merge (Fabric/worklet feel-pass — house rule). The card swipe is a new gesture: check it doesn't fight the screen's vertical scroll.

Work on a branch, keep the engine in its own file (`lib/colour-capture.ts` or similar) mirroring the prototype's structure, and note any intentional deviation from the prototype in the PR description with the reason.
