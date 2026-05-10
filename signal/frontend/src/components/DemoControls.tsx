import { useState, useEffect } from 'react'
import { Mode } from '../types'

type ButtonId = 'start' | 'surge' | 'reset'

interface Props {
  mode?: Mode
}

interface ButtonState {
  loading: boolean
  error: string | null
}

const ENDPOINTS: Record<ButtonId, string> = {
  start: '/api/demo/start',
  surge: '/api/demo/trigger-surge',
  reset: '/api/demo/reset',
}

export default function DemoControls({ mode }: Props) {
  const [states, setStates] = useState<Record<ButtonId, ButtonState>>({
    start: { loading: false, error: null },
    surge: { loading: false, error: null },
    reset: { loading: false, error: null },
  })
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

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

  const anyError = (['start', 'surge', 'reset'] as ButtonId[]).find((id) => states[id].error)

  return (
    <div className="demo-bar">
      <span className="demo-label">Demo Controls</span>
      <div className="demo-actions">
        <button
          className="demo-btn"
          disabled={states.start.loading}
          onClick={() => handleClick('start')}
        >
          {states.start.loading ? '…' : '▶'} Start Demo
        </button>
        <button
          className="demo-btn danger"
          disabled={states.surge.loading || mode === 'SURGE'}
          onClick={() => handleClick('surge')}
        >
          {states.surge.loading ? '…' : '⚡'} Trigger Surge
        </button>
        <button
          className="demo-btn"
          disabled={states.reset.loading}
          onClick={() => handleClick('reset')}
        >
          {states.reset.loading ? '…' : '↺'} Reset
        </button>
        {anyError && (
          <span className="demo-error">Request failed</span>
        )}
      </div>
      <div className="demo-clock">
        <span>v0.9-demo</span>
        <span>·</span>
        <span>OPERATOR D-114</span>
        <span>·</span>
        <span>{now.toLocaleTimeString()}</span>
      </div>
    </div>
  )
}
