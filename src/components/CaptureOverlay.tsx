import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { extractPalette, samplePixels } from '../lib/colourEngine'
import type { EngineTuning, PaletteEntry } from '../lib/types'
import { useCamera } from '../hooks/useCamera'

const LIVE_SAMPLE_MS = 400

type CaptureSource = HTMLVideoElement | HTMLImageElement

function PhotosIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <circle cx="9.2" cy="10" r="1.6" />
      <path d="m4.5 16.5 4-4 3 3 3.5-3.5 4.5 4.5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 2l10 10M12 2 2 12"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface Props {
  mode: 'camera' | 'photo'
  /** Data URL of the chosen photo (photo mode only). */
  photoSrc?: string
  tuning: EngineTuning
  onClose: () => void
  onCaptured: (palette: PaletteEntry[]) => void
  /** Camera mode: switch this overlay to a picked photo. */
  onPickPhoto: (dataUrl: string) => void
}

export function CaptureOverlay({ mode, photoSrc, tuning, onClose, onCaptured, onPickPhoto }: Props) {
  const reduced = useReducedMotion()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const { videoRef, status, error } = useCamera(mode === 'camera')
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [palette, setPalette] = useState<PaletteEntry[]>([])
  const [photoReady, setPhotoReady] = useState(false)

  const tuningRef = useRef(tuning)
  tuningRef.current = tuning

  // Live palette: sample the current camera frame every ~400ms.
  useEffect(() => {
    if (mode !== 'camera' || status !== 'live') return
    const id = window.setInterval(() => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || !video.videoWidth) return
      try {
        const t = tuningRef.current
        setPalette(extractPalette(samplePixels(video, t.maxSamples), t.colorCount))
      } catch {
        // Frame not decodable yet — try again next tick.
      }
    }, LIVE_SAMPLE_MS)
    return () => window.clearInterval(id)
  }, [mode, status, videoRef])

  // Photo mode: compute the palette once the image has decoded.
  const handlePhotoLoad = () => {
    const img = imgRef.current
    if (!img) return
    try {
      const t = tuningRef.current
      setPalette(extractPalette(samplePixels(img, t.maxSamples), t.colorCount))
      setPhotoReady(true)
    } catch {
      setPhotoReady(false)
    }
  }

  // Escape closes (camera cleanup happens via useCamera unmount).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleConfirm = () => {
    const source: CaptureSource | null =
      mode === 'camera' ? videoRef.current : imgRef.current
    if (!source) return
    if (source instanceof HTMLVideoElement) {
      if (!source.videoWidth) return
      source.pause() // freeze the frame while we compute
    }
    try {
      const t = tuningRef.current
      const captured = extractPalette(samplePixels(source, t.maxSamples), t.colorCount)
      onCaptured(captured)
    } catch {
      onClose()
    }
  }

  const ready = mode === 'camera' ? status === 'live' && !error : photoReady

  // Unique keys for the animated strip even if the engine repeats a hex.
  const seen = new Map<string, number>()
  const keyed = palette.map((entry) => {
    const n = seen.get(entry.hex) ?? 0
    seen.set(entry.hex, n + 1)
    return { entry, key: n === 0 ? entry.hex : `${entry.hex}-${n}` }
  })

  const spring = { type: 'spring' as const, visualDuration: 0.3, bounce: 0.2 }

  return (
    <motion.div
      className="capture-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'camera' ? 'Capture colours with the camera' : 'Capture colours from a photo'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.01 : 0.2, ease: 'easeOut' }}
    >
      <motion.div
        className="capture-sheet"
        initial={reduced ? false : { y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { y: 24, opacity: 0 }}
        transition={reduced ? { duration: 0.01 } : spring}
      >
        <div className="capture-top">
          <span className="capture-title">
            {mode === 'camera' ? 'Camera' : 'Photo'}
          </span>
          <button
            type="button"
            className="capture-close"
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="viewfinder">
          {mode === 'camera' ? (
            error ? (
              <p className="capture-error">{error}</p>
            ) : (
              <video ref={videoRef} playsInline muted autoPlay />
            )
          ) : (
            <img
              ref={imgRef}
              src={photoSrc}
              alt="Chosen photo"
              onLoad={handlePhotoLoad}
            />
          )}
        </div>
        <div className="palette-strip" aria-label="Detected palette">
          {keyed.map(({ entry, key }, i) => (
            <motion.span
              key={key}
              className="palette-swatch"
              style={{ backgroundColor: entry.hex }}
              title={entry.hex}
              layout={!reduced}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                reduced ? { duration: 0.01 } : { ...spring, delay: i * 0.02 }
              }
            />
          ))}
        </div>
        <div className="capture-actions">
          <button
            type="button"
            className="capture-shutter"
            disabled={!ready}
            onClick={handleConfirm}
          >
            {mode === 'camera' ? 'Capture' : 'Use photo'}
          </button>
          {mode === 'camera' && (
            <>
              <button
                type="button"
                className="icon-btn-44"
                aria-label="Pick a photo from the library instead"
                onClick={() => fileRef.current?.click()}
              >
                <PhotosIcon />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    if (typeof reader.result === 'string') onPickPhoto(reader.result)
                  }
                  reader.readAsDataURL(file)
                }}
              />
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
