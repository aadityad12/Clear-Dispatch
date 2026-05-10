import { useReducer, useCallback, useState, useEffect, useRef } from 'react'
import { reducer, initialState } from './store/reducer'
import { useWebSocket } from './hooks/useWebSocket'
import { WsMessage, AgentName } from './types'
import ModeIndicator from './components/ModeIndicator'
import AgentCards from './components/AgentCards'
import CallQueue from './components/CallQueue'
import MapView, { MapHandle } from './components/MapView'
import OverrideButton from './components/OverrideButton'
import HoldModal from './components/HoldModal'
import BriefingPanel from './components/BriefingPanel'
import AuditTrail from './components/AuditTrail'
import DemoControls from './components/DemoControls'

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null)
  const [agentFlash, setAgentFlash] = useState<Record<string, boolean>>({})
  const prevAgentsRef = useRef(state.agents)
  const mapRef = useRef<MapHandle>(null)

  // Flash agent cards when transitioning into RUNNING
  useEffect(() => {
    const flashes: Record<string, boolean> = {}
    ;(Object.keys(state.agents) as AgentName[]).forEach((name) => {
      const prev = prevAgentsRef.current[name]
      if (prev?.status !== 'RUNNING' && state.agents[name].status === 'RUNNING') {
        flashes[name] = true
      }
    })
    if (Object.keys(flashes).length > 0) {
      setAgentFlash((f) => ({ ...f, ...flashes }))
      setTimeout(() => {
        setAgentFlash((f) => {
          const next = { ...f }
          Object.keys(flashes).forEach((k) => delete next[k])
          return next
        })
      }, 600)
    }
    prevAgentsRef.current = state.agents
  }, [state.agents])

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
    <div className="app-shell">
      <ModeIndicator mode={state.mode} connected={state.connected} />

      <div className="main-grid">
        <CallQueue
          calls={state.calls}
          onShowOnMap={(lat, lon) => mapRef.current?.flyTo(lat, lon)}
        />
        <MapView ref={mapRef} calls={state.calls} mode={state.mode} />
        <div className="right-col">
          <AgentCards agents={state.agents} flashing={agentFlash} />
          <BriefingPanel
            briefings={state.briefings}
            audioBlocked={audioBlocked}
            onPlayAudio={handlePlayAudio}
          />
        </div>
      </div>

      <AuditTrail entries={state.auditLog} />
      <DemoControls mode={state.mode} />

      <OverrideButton mode={state.mode} onOverride={() => {}} />

      <HoldModal
        hold={state.activeHold}
        onConfirm={handleConfirmHold}
        onCancel={handleCancelHold}
      />
    </div>
  )
}
