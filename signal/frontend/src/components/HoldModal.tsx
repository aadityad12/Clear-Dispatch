import { useState } from 'react'
import { HoldEvent } from '../types'

interface Props {
  hold: HoldEvent | null
  onConfirm: (holdId: string) => void
  onCancel: (holdId: string) => void
}

const ASSET_LABELS: Record<string, string> = {
  air_tanker:    'Air Tanker deployment requested',
  heavy_rescue:  'Heavy Rescue deployment requested',
  hazmat:        'Hazmat deployment requested',
}

function formatAsset(type: string): string {
  return ASSET_LABELS[type] ?? `${type} deployment requested`
}

export default function HoldModal({ hold, onConfirm, onCancel }: Props) {
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null)

  if (!hold) return null

  const handleConfirm = async () => {
    if (busy) return
    setBusy('confirm')
    try {
      await fetch('/api/confirm-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold_id: hold.hold_id }),
      })
    } catch {
      // proceed regardless
    }
    onConfirm(hold.hold_id)
    setBusy(null)
  }

  const handleCancel = async () => {
    if (busy) return
    setBusy('cancel')
    try {
      await fetch('/api/cancel-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold_id: hold.hold_id }),
      })
    } catch {
      // proceed regardless
    }
    onCancel(hold.hold_id)
    setBusy(null)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
        <h2 className="text-red-600 font-bold text-lg mb-4">
          ⚠️ PROTOCOL HOLD — Dispatcher Confirmation Required
        </h2>

        <div className="space-y-2 mb-6">
          <p className="text-slate-900 font-medium">{formatAsset(hold.asset_type)}</p>
          <p className="text-sm text-slate-500">
            Call ID: <span className="font-mono">{hold.call_id}</span>
          </p>
          <p className="text-sm text-slate-600 mt-3">
            This action requires dispatcher approval before proceeding.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={busy !== null}
            className="flex-1 bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy === 'confirm' ? 'Confirming…' : 'Confirm'}
          </button>
          <button
            onClick={handleCancel}
            disabled={busy !== null}
            className="flex-1 bg-slate-100 text-slate-700 px-8 py-3 rounded-lg font-semibold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
