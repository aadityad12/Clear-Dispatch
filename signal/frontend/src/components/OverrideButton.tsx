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
      // backend offline — still call onOverride so UI doesn't get stuck
      onOverride()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="fixed bottom-20 right-6 z-50 bg-white border-2 border-red-500 text-red-600 font-semibold px-6 py-3 rounded-full shadow-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
    >
      ⬛ Override — Return to Manual
    </button>
  )
}
