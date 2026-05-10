import { useState } from 'react'

type ButtonId = 'start' | 'surge' | 'reset'

interface ButtonState {
  loading: boolean
  error: string | null
}

const ENDPOINTS: Record<ButtonId, string> = {
  start: '/api/demo/start',
  surge: '/api/demo/trigger-surge',
  reset: '/api/demo/reset',
}

export default function DemoControls() {
  const [states, setStates] = useState<Record<ButtonId, ButtonState>>({
    start: { loading: false, error: null },
    surge: { loading: false, error: null },
    reset: { loading: false, error: null },
  })

  const handleClick = async (id: ButtonId) => {
    setStates((s) => ({ ...s, [id]: { loading: true, error: null } }))
    try {
      const res = await fetch(ENDPOINTS[id], { method: 'POST' })
      if (!res.ok) throw new Error(`${res.status}`)
      setStates((s) => ({ ...s, [id]: { loading: false, error: null } }))
    } catch {
      setStates((s) => ({ ...s, [id]: { loading: false, error: 'Request failed' } }))
      setTimeout(() => {
        setStates((s) => ({ ...s, [id]: { loading: false, error: null } }))
      }, 3000)
    }
  }

  const btn = (
    id: ButtonId,
    label: string,
    extraClass: string,
  ) => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleClick(id)}
        disabled={states[id].loading}
        className={`text-sm border px-3 py-1.5 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${extraClass}`}
      >
        {states[id].loading ? '…' : label}
      </button>
      {states[id].error && (
        <span className="text-xs text-red-500">{states[id].error}</span>
      )}
    </div>
  )

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center gap-6 z-40">
      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
        Demo Controls
      </span>
      {btn('start', 'Start Demo', 'border-slate-300 text-slate-700 hover:bg-slate-50')}
      {btn('surge', 'Trigger Surge', 'border-red-300 text-red-600 hover:bg-red-50')}
      {btn('reset', 'Reset', 'border-slate-300 text-slate-600 hover:bg-slate-50')}
    </div>
  )
}
