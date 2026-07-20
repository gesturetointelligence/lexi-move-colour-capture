import { toInputHex } from '../lib/presets'

interface ColourDotProps {
  value: string
  label: string
  onChange: (hex: string) => void
}

/** 28px brand colour dot with the native colour picker layered over it. */
function ColourDot({ value, label, onChange }: ColourDotProps) {
  return (
    <span className="colour-dot">
      <span className="colour-dot-fill" style={{ backgroundColor: value }} aria-hidden="true" />
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
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F8F9F9"
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

export function Controls({
  cardColor,
  textColor,
  onCardColor,
  onTextColor,
  onOpenCapture,
}: Props) {
  return (
    <div className="controls">
      <div className="control-row">
        <span className="control-label">Card</span>
        <ColourDot value={cardColor} label="Card colour" onChange={onCardColor} />
      </div>
      <div className="control-divider" aria-hidden="true" />
      <div className="control-row">
        <span className="control-label">Text</span>
        <ColourDot value={textColor} label="Text colour" onChange={onTextColor} />
      </div>
      <div className="control-divider" aria-hidden="true" />
      <button
        type="button"
        className="control-row control-row-btn"
        aria-label="Capture colours from the camera or a photo"
        onClick={onOpenCapture}
      >
        <span className="control-label">Capture</span>
        <span className="control-icon" aria-hidden="true">
          <EyedropperIcon />
        </span>
      </button>
    </div>
  )
}
