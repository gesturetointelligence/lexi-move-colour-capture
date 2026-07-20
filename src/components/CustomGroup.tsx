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

function EyedropperIcon() {
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
      <path d="m13.2 7.3 3.5 3.5" />
      <path d="M6 21c-1.1.35-2.35-.9-2-2l.7-2.1a3 3 0 0 1 .72-1.17l7.28-7.28 3.85 3.85-7.28 7.28A3 3 0 0 1 8.1 20.3L6 21Z" />
      <path d="M14.5 6 17 3.5a2.47 2.47 0 0 1 3.5 3.5L18 9.5" />
    </svg>
  )
}

interface Props {
  cardColor: string
  textColor: string
  onCardColor: (hex: string) => void
  onTextColor: (hex: string) => void
  onOpenCapture: () => void
}

export function CustomGroup({
  cardColor,
  textColor,
  onCardColor,
  onTextColor,
  onOpenCapture,
}: Props) {
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
      <button
        type="button"
        className="capture-row-btn"
        aria-label="Pick colours from the camera or a photo"
        onClick={onOpenCapture}
      >
        <EyedropperIcon />
      </button>
    </div>
  )
}
