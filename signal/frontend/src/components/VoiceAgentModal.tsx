import { useState, useEffect, useRef } from 'react'
import { useConversation } from '@elevenlabs/react'

interface Props {
  callId: string
  onComplete: (transcript: string) => void
  onDismiss: () => void
}

const AGENT_ID = 'agent_1701kr8n4kw9fr9aapm59ca3edg8'

export default function VoiceAgentModal({ callId, onComplete, onDismiss }: Props) {
  const [transcript, setTranscript] = useState<string>('')
  const [micError, setMicError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)

  const conversation = useConversation({
    onMessage: ({ message, source }: { message: string; source: 'ai' | 'user' }) => {
      const speaker = source === 'ai' ? '[CLEAR DISPATCH]' : '[CALLER]'
      setTranscript((t) => t + `${speaker}: ${message}\n`)
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error)
      setMicError(`Voice agent error: ${msg}`)
    },
  })

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  // Start session on mount
  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) return
        await conversation.startSession({
          agentId: AGENT_ID,
        })
      } catch (err) {
        if (!cancelled) {
          setMicError(err instanceof Error ? err.message : 'Microphone access denied')
        }
      }
    }
    start()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEndCall = async () => {
    setEnding(true)
    try {
      await conversation.endSession()
    } catch {
      // best-effort
    }
    onComplete(transcript)
  }

  const statusColor = conversation.status === 'connected' ? '#10b981' : '#6b7280'
  const statusLabel =
    conversation.status === 'connected'
      ? conversation.isSpeaking
        ? 'Clear Dispatch speaking…'
        : 'Connected — listening'
      : conversation.status === 'connecting'
      ? 'Connecting…'
      : 'Disconnected'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        style={{
          background: '#111827',
          border: '1px solid #374151',
          borderRadius: 12,
          width: 480,
          maxWidth: '90vw',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb', letterSpacing: '0.05em' }}>
              SURGE VOICE AGENT
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              Call ID: {callId}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {conversation.isSpeaking && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ef4444',
                  display: 'inline-block',
                  animation: 'pulse-dot 1s ease-in-out infinite',
                }}
              />
            )}
            <span style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
          </div>
        </div>

        {/* Status indicator bar */}
        <div
          style={{
            height: 3,
            background: '#1f2937',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: conversation.status === 'connected' ? '100%' : conversation.status === 'connecting' ? '40%' : '0%',
              background: statusColor,
              transition: 'width 0.5s ease, background 0.3s ease',
            }}
          />
        </div>

        {/* Mic error */}
        {micError && (
          <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#fca5a5' }}>
            {micError}
          </div>
        )}

        {/* Transcript panel */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', marginBottom: 6 }}>
            CONVERSATION TRANSCRIPT
          </div>
          <div
            ref={transcriptRef}
            style={{
              background: '#0f172a',
              border: '1px solid #1f2937',
              borderRadius: 8,
              padding: '10px 12px',
              height: 180,
              overflowY: 'auto',
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
            }}
          >
            {transcript
              ? transcript.split('\n').filter(Boolean).map((line, i) => {
                  const isClearDispatch = line.startsWith('[CLEAR DISPATCH]')
                  return (
                    <div key={i} style={{ color: isClearDispatch ? '#ef4444' : '#e5e7eb', marginBottom: 2 }}>
                      {line}
                    </div>
                  )
                })
              : (
                <span style={{ color: '#4b5563', fontStyle: 'italic' }}>
                  {conversation.status === 'connecting' ? 'Connecting to voice agent…' : 'Waiting for conversation to begin…'}
                </span>
              )
            }
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onDismiss}
            disabled={ending}
            style={{
              background: 'transparent',
              border: '1px solid #374151',
              borderRadius: 6,
              color: '#9ca3af',
              fontSize: 13,
              padding: '7px 16px',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
          <button
            onClick={handleEndCall}
            disabled={ending}
            style={{
              background: ending ? '#374151' : '#7f1d1d',
              border: '1px solid #b91c1c',
              borderRadius: 6,
              color: '#fecaca',
              fontSize: 13,
              fontWeight: 600,
              padding: '7px 20px',
              cursor: ending ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {ending ? (
              <>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b7280', display: 'inline-block' }} />
                Ending…
              </>
            ) : (
              <>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                End Call
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}
