import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { toInputHex } from '../lib/presets'

interface ColourWheelProps {
  value: string
  label: string
  onChange: (hex: string) => void
}

/** 44px colour-wheel control: conic rainbow ring, current colour centre, native picker. */
function ColourWheel({ value, label, onChange }: ColourWheelProps) {
  return (
    <span className="colour-wheel">
      <span className="wheel-ring" aria-hidden="true" />
      <span
        className="wheel-centre"
        style={{ backgroundColor: value }}
        aria-hidden="true"
      />
      <input
        type="color"
        value={toInputHex(value)}
        aria-label={label}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
    </span>
  )
}

function CameraIcon() {
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
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l.95-1.52A1.5 1.5 0 0 1 10.02 3.75h3.96a1.5 1.5 0 0 1 1.27.73L16.2 6h1.3A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  )
}

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

interface Props {
  cardColor: string
  textColor: string
  /** Small provenance thumbnail of the last capture, if any. */
  captureThumb: string | null
  onCardColor: (hex: string) => void
  onTextColor: (hex: string) => void
  onOpenCamera: () => void
  onPhotoPicked: (dataUrl: string) => void
}

export function CustomGroup({
  cardColor,
  textColor,
  captureThumb,
  onCardColor,
  onTextColor,
  onOpenCamera,
  onPhotoPicked,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const reduced = useReducedMotion()

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset so picking the same photo again still fires change.
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onPhotoPicked(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="custom-group">
      <div className="custom-row">
        <span className="custom-label">Card</span>
        <ColourWheel value={cardColor} label="Card colour" onChange={onCardColor} />
      </div>
      <div className="custom-divider" aria-hidden="true" />
      <div className="custom-row">
        <span className="custom-label">Text</span>
        <ColourWheel value={textColor} label="Text colour" onChange={onTextColor} />
      </div>
      <div className="custom-divider" aria-hidden="true" />
      <div className="custom-row">
        <span className="custom-label">Capture</span>
        <span className="capture-controls">
          {captureThumb && (
            <motion.img
              className="capture-thumb"
              src={captureThumb}
              alt="Last captured frame"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                reduced
                  ? { duration: 0.01 }
                  : { type: 'spring', visualDuration: 0.3, bounce: 0.2 }
              }
            />
          )}
          <button
            type="button"
            className="icon-btn-44"
            aria-label="Capture colours with the camera"
            onClick={onOpenCamera}
          >
            <CameraIcon />
          </button>
          <button
            type="button"
            className="icon-btn-44"
            aria-label="Pick colours from a photo"
            onClick={() => fileRef.current?.click()}
          >
            <PhotosIcon />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFile}
          />
        </span>
      </div>
    </div>
  )
}
