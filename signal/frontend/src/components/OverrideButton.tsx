import { useState } from 'react'
import { Mode } from '../types'

interface Props {
  mode: Mode
  onOverride: () => void
}

export default function OverrideButton({ mode, onOverride }: Props) {
  const [busy, setBusy] = useState(false)

  if (mode !== 'SURGE') return null

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/override', { method: 'POST' })
      onOverride()
    } catch {
      onOverride()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      className="override-btn"
      onClick={handleClick}
      disabled={busy}
      aria-label="Override — return to manual"
    >
      {busy ? <span className="spinner" /> : <span>⬛</span>}
      <span>Override — Return to Manual</span>
    </button>
  )
}
