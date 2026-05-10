import { useReducer, useCallback, useState } from 'react'
import { reducer, initialState } from './store/reducer'
import { useWebSocket } from './hooks/useWebSocket'
import { WsMessage } from './types'
import ModeIndicator from './components/ModeIndicator'
import AgentCards from './components/AgentCards'
import CallQueue from './components/CallQueue'
import MapView from './components/MapView'
import OverrideButton from './components/OverrideButton'
import HoldModal from './components/HoldModal'
import BriefingPanel from './components/BriefingPanel'
import AuditTrail from './components/AuditTrail'
import DemoControls from './components/DemoControls'

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null)

  const onMessage = useCallback((msg: WsMessage) => {
    dispatch({ type: 'WS_MESSAGE', message: msg })
    if (msg.type === 'BRIEFING_READY' && msg.payload.audio_url) {
      new Audio(msg.payload.audio_url).play().catch(() => {
        setAudioBlocked(true)
        setPendingAudioUrl(msg.payload.audio_url)
      })
    }
  }, [])

  const onConnect = useCallback(() => dispatch({ type: 'WS_CONNECTED' }), [])
  const onDisconnect = useCallback(() => dispatch({ type: 'WS_DISCONNECTED' }), [])

  useWebSocket(onMessage, onConnect, onDisconnect)

  const handleConfirmHold = useCallback((holdId: string) => {
    dispatch({ type: 'WS_MESSAGE', message: { type: 'HOLD_RESOLVED', payload: { hold_id: holdId, action: 'CONFIRMED' } } })
  }, [])

  const handleCancelHold = useCallback((holdId: string) => {
    dispatch({ type: 'WS_MESSAGE', message: { type: 'HOLD_RESOLVED', payload: { hold_id: holdId, action: 'CANCELLED' } } })
  }, [])

  const handlePlayAudio = useCallback(() => {
    if (pendingAudioUrl) {
      new Audio(pendingAudioUrl).play()
      setAudioBlocked(false)
      setPendingAudioUrl(null)
    }
  }, [pendingAudioUrl])

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <ModeIndicator mode={state.mode} connected={state.connected} />

      <main className="flex-1 p-6 pb-20">
        <div className="grid grid-cols-3 gap-6">
          <CallQueue calls={state.calls} />
          <MapView calls={state.calls} />
          <div className="flex flex-col gap-4">
            <AgentCards agents={state.agents} />
            <BriefingPanel
              briefings={state.briefings}
              audioBlocked={audioBlocked}
              onPlayAudio={handlePlayAudio}
            />
          </div>
        </div>
      </main>

      <AuditTrail entries={state.auditLog} />
      <DemoControls />

      <OverrideButton mode={state.mode} onOverride={() => {}} />

      <HoldModal
        hold={state.activeHold}
        onConfirm={handleConfirmHold}
        onCancel={handleCancelHold}
      />
    </div>
  )
}
