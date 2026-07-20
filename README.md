# lexi-move-colour-capture

Exploring how card and text colours can be captured from the world — live camera and photo library — and judged into eight best combinations, algorithmically.

---

## What It Is

An isolated web replica of Magic's Themes screen, used as a rig for a new UI pattern. A capture row joins the Card/Text customisation group: point the camera at anything (or pick a photo) and a colour-thief-style engine — median-cut quantisation, no AI — extracts the dominant palette and scores every card/text pairing for contrast (WCAG), chroma, dominance, and hue harmony. The eight best combos survive a diversity pass, and the "hello, world." card becomes tappable, looping through them. Any combo can be pinned to the presets row via the (+) button that now leads the COLOURS row.

A DialKit panel (top right) exposes the engine's scoring weights so the judging can be tuned live.

## How to Run

```bash
npm install
npm run dev
```

Camera capture needs a secure context (localhost counts) and, when iframed, `allow="camera"` on the host iframe.

## What It Connects To

Directly probes Magic's Themes screen (`apps/magic-mobile/app/settings/app/theme.tsx`) — preset geometry, the curated 16-set, and the Card/Text picker group are replicated with the app's exact values. If the pattern lands, the capture row and combo loop are candidates for Magic itself. Palette extraction lineage: [Color Thief](https://lokeshdhakar.com/projects/color-thief/) / MMCQ.

## Authors

- Ravi

## Date

2026-07-20
