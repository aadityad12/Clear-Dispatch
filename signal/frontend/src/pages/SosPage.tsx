import { useState, useEffect, useRef } from 'react'
import { useConversation } from '@elevenlabs/react'

const AGENT_ID = 'agent_1701kr8n4kw9fr9aapm59ca3edg8'
const FALLBACK_LAT = 38.5449
const FALLBACK_LON = -121.7405
const POLL_INTERVAL_MS = 3000

type PageState = 'waiting' | 'ready' | 'locating' | 'connecting' | 'connected' | 'done' | 'error'

export default function SosPage() {
  const [pageState, setPageState] = useState<PageState>('waiting')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [callId, setCallId] = useState<string | null>(null)
  const transcriptRef = useRef<string>('')
  const prevStatusRef = useRef<string>('disconnected')
  const submittedRef = useRef(false)

  const conversation = useConversation({
    onMessage: ({ message, source }: { message: string; source: 'ai' | 'user' }) => {
      const speaker = source === 'ai' ? '[SIGNAL]' : '[CALLER]'
      transcriptRef.current += `${speaker}: ${message}\n`
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error)
      setErrorMsg(`Voice agent error: ${msg}`)
      setPageState('error')
    },
  })

  // Poll /api/health until SURGE mode is active
  useEffect(() => {
    if (pageState !== 'waiting') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/health')
        const data = await res.json()
        if (data.mode === 'SURGE') {
          clearInterval(interval)
          setPageState('ready')
        }
      } catch {
        // backend not yet available, keep polling
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [pageState])

  // Watch for agent-triggered disconnect to auto-submit transcript
  useEffect(() => {
    if (
      prevStatusRef.current === 'connected' &&
      conversation.status === 'disconnected' &&
      pageState === 'connected' &&
      !submittedRef.current
    ) {
      submitTranscript()
    }
    prevStatusRef.current = conversation.status
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.status])

  async function handleSosPress() {
    setPageState('locating')
    let lat = FALLBACK_LAT
    let lon = FALLBACK_LON

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 6000,
          enableHighAccuracy: true,
        })
      })
      lat = pos.coords.latitude
      lon = pos.coords.longitude
    } catch {
      // use fallback coords silently
    }

    setPageState('connecting')
    try {
      const res = await fetch('/api/surge/call/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCallId(data.call_id)

      await navigator.mediaDevices.getUserMedia({ audio: true })
      await conversation.startSession({ agentId: AGENT_ID })
      setPageState('connected')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to connect')
      setPageState('error')
    }
  }

  async function submitTranscript() {
    if (submittedRef.current || !callId) return
    submittedRef.current = true
    try {
      await fetch('/api/surge/call/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, transcript: transcriptRef.current }),
      })
    } catch {
      // best-effort
    }
    setPageState('done')
  }

  async function handleEndCall() {
    try {
      await conversation.endSession()
    } catch {
      // best-effort
    }
    await submitTranscript()
  }

  return (
    <div style={styles.page}>
      {pageState === 'waiting' && <WaitingScreen />}
      {pageState === 'ready' && <ReadyScreen onPress={handleSosPress} />}
      {pageState === 'locating' && <StatusScreen label="Getting your location…" showSpinner />}
      {pageState === 'connecting' && <StatusScreen label="Connecting to emergency services…" showSpinner />}
      {pageState === 'connected' && (
        <ConnectedScreen
          isSpeaking={conversation.isSpeaking}
          onEndCall={handleEndCall}
        />
      )}
      {pageState === 'done' && <DoneScreen />}
      {pageState === 'error' && <ErrorScreen message={errorMsg} onRetry={() => { submittedRef.current = false; setPageState('ready') }} />}

      <style>{`
        @keyframes sos-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50% { box-shadow: 0 0 0 40px rgba(239,68,68,0); }
        }
        @keyframes conn-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          50% { box-shadow: 0 0 0 20px rgba(16,185,129,0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function WaitingScreen() {
  return (
    <div style={styles.center}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔴</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.1em', textAlign: 'center' }}>
        AWAITING EMERGENCY DECLARATION
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>
        Dispatcher must activate Surge Mode first
      </div>
      <div style={{ marginTop: 24, width: 24, height: 24, border: '3px solid #374151', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )
}

function ReadyScreen({ onPress }: { onPress: () => void }) {
  return (
    <div style={styles.center}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', letterSpacing: '0.15em', marginBottom: 32 }}>
        EMERGENCY SERVICES ACTIVE
      </div>
      <button
        onClick={onPress}
        style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: '#dc2626',
          border: '6px solid #ef4444',
          color: '#fff',
          fontSize: 52,
          fontWeight: 900,
          letterSpacing: '0.05em',
          cursor: 'pointer',
          animation: 'sos-pulse 2s ease-in-out infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        SOS
      </button>
      <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 28, textAlign: 'center' }}>
        Tap to connect to emergency services
      </div>
    </div>
  )
}

function StatusScreen({ label, showSpinner }: { label: string; showSpinner?: boolean }) {
  return (
    <div style={styles.center}>
      {showSpinner && (
        <div style={{ width: 32, height: 32, border: '3px solid #374151', borderTopColor: '#ef4444', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 20 }} />
      )}
      <div style={{ fontSize: 16, color: '#e5e7eb', textAlign: 'center' }}>{label}</div>
    </div>
  )
}

function ConnectedScreen({ isSpeaking, onEndCall }: { isSpeaking: boolean; onEndCall: () => void }) {
  return (
    <div style={{ ...styles.center, justifyContent: 'space-between', paddingTop: 80, paddingBottom: 60 }}>
      <div style={styles.center}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: isSpeaking ? '#059669' : '#10b981',
            animation: 'conn-pulse 1.5s ease-in-out infinite',
            marginBottom: 24,
          }}
        />
        <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', letterSpacing: '0.08em' }}>
          CONNECTED
        </div>
        <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 8 }}>
          {isSpeaking ? 'Agent speaking…' : 'Speak now — we can hear you'}
        </div>
      </div>
      <button
        onClick={onEndCall}
        style={{
          background: '#1f2937',
          border: '1px solid #374151',
          borderRadius: 8,
          color: '#9ca3af',
          fontSize: 14,
          padding: '12px 32px',
          cursor: 'pointer',
        }}
      >
        End Call
      </button>
    </div>
  )
}

function DoneScreen() {
  return (
    <div style={styles.center}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', letterSpacing: '0.08em', textAlign: 'center' }}>
        DISPATCH NOTIFIED
      </div>
      <div style={{ fontSize: 16, color: '#e5e7eb', marginTop: 12, textAlign: 'center' }}>
        Help is on the way
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 20, textAlign: 'center' }}>
        Stay calm and follow instructions from emergency services when they arrive
      </div>
      <div style={{ fontSize: 12, color: '#4b5563', marginTop: 32 }}>
        You can close this page
      </div>
    </div>
  )
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={styles.center}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontSize: 16, color: '#fca5a5', textAlign: 'center', maxWidth: 280 }}>{message}</div>
      <button
        onClick={onRetry}
        style={{
          marginTop: 24,
          background: '#dc2626',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          padding: '12px 32px',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#030712',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#f9fafb',
    padding: '24px',
    boxSizing: 'border-box' as const,
  },
  center: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
    gap: 0,
  },
}
