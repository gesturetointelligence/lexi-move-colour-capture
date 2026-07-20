# lexi-move-colour-capture

Capturing card and text colours from the world — live camera and photo library — and judging them into eight best combinations, algorithmically, in the Lexi Play brand system.

---

## What It Is

An abstracted colour-capture playground — a Lexi Play brand artefact, not an iOS screen. A signal-lime "hello, world." hero card sits above a presets row and a small Controls group (Card / Text / Capture). Point the camera at anything (or pick a photo) and a colour-thief-style engine — median-cut quantisation, no AI — extracts the dominant palette and scores every card/text pairing for contrast (WCAG), chroma, dominance, and hue harmony. The eight best combos survive a diversity pass, and the hero card becomes tappable, looping through them. Any pair can be pinned to the presets row via the (+) that leads the row; a small seed set of brand combos replaces the iOS app's curated set.

It was first proven as a faithful replica of Magic's Themes screen; that fidelity has been stripped and it now lives in the same black / white / signal-lime brand vocabulary as the other moves (gaze-anchor, dwell-windows).

A DialKit panel (top right) exposes the engine's scoring weights so the judging can be tuned live.

## How to Run

```bash
npm install
npm run dev
```

Camera capture needs a secure context (localhost counts) and, when iframed, `allow="camera"` on the host iframe.

## What It Connects To

The colour engine (`src/lib/colourEngine.ts`) is the oracle for the eventual in-app port — the scoring, diversity pass, and tuning defaults here are the reference implementation that the Magic app should match. `docs/lexi-magic-prompt.md` is the handover brief for that port. Palette extraction lineage: [Color Thief](https://lokeshdhakar.com/projects/color-thief/) / MMCQ.

## Authors

- Ravi

## Date

2026-07-20
