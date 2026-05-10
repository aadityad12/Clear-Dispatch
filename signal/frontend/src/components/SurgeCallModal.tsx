import React, { useRef, useEffect } from 'react'
import { Call } from '../types'

interface Props {
  call: Call
  onDismiss: () => void
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '#ef4444'
    case 'URGENT': return '#f97316'
    case 'STANDARD': return '#3b82f6'
    default: return '#6b7280'
  }
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#6b7280',
        letterSpacing: '0.08em',
      }}>
        {children}
      </div>
      {aside}
    </div>
  )
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#1f2937', borderRadius: 6, padding: '6px 10px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', marginBottom: 2 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: color ?? '#e5e7eb' }}>
        {value}
      </div>
    </div>
  )
}

export default function SurgeCallModal({ call, onDismiss }: Props) {
  const sevColor = getSeverityColor(call.severity)
  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [call.transcript])

  const transcriptContent = call.transcript || call.description

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
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          width: 540,
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb', letterSpacing: '0.05em' }}>
              SURGE CALL
            </span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>{call.id}</span>
            <span
              style={{
                background: `${sevColor}22`,
                border: `1px solid ${sevColor}66`,
                color: sevColor,
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 10,
                letterSpacing: '0.06em',
              }}
            >
              {call.severity}
            </span>
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              color: '#9ca3af',
              fontSize: 16,
              lineHeight: 1,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* 1. Caller Transcript */}
        <div>
          <SectionTitle
            aside={call.live ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#ef4444',
                  display: 'inline-block',
                  animation: 'surge-pulse 1.2s ease-in-out infinite',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', letterSpacing: '0.06em' }}>
                  LIVE
                </span>
              </div>
            ) : undefined}
          >
            CALLER TRANSCRIPT
          </SectionTitle>
          <div
            ref={transcriptRef}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              lineHeight: 1.6,
              maxHeight: 120,
              overflowY: 'auto',
              color: transcriptContent ? '#d1d5db' : '#4b5563',
              fontStyle: transcriptContent ? 'normal' : 'italic',
              whiteSpace: 'pre-wrap',
              minHeight: 48,
            }}
          >
            {transcriptContent || 'Awaiting transcript…'}
          </div>
        </div>

        {/* 2. AI Analysis */}
        <div>
          <SectionTitle>AI ANALYSIS</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field
              label="Severity"
              value={call.severity}
              color={getSeverityColor(call.severity)}
            />
            <Field
              label="Incident Type"
              value={call.incident_type || 'Unknown'}
            />
            <Field
              label="Zone"
              value={call.zone}
            />
            {call.vulnerable && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>⚠</span>
                <span>Vulnerable caller — priority response</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. AI Briefing */}
        <div>
          <SectionTitle>AI BRIEFING</SectionTitle>
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              lineHeight: 1.6,
              color: call.briefing_text ? '#d1d5db' : '#4b5563',
              fontStyle: call.briefing_text ? 'normal' : 'italic',
              minHeight: 48,
            }}
          >
            {call.briefing_text || 'Awaiting briefing…'}
          </div>
        </div>

        {/* 4. Dispatch */}
        <div>
          <SectionTitle>DISPATCH</SectionTitle>
          <div
            style={{
              background: '#1f2937',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: call.unit_id ? '#4ade80' : '#4b5563',
              fontStyle: call.unit_id ? 'normal' : 'italic',
            }}
          >
            {call.unit_id
              ? `Unit ${call.unit_id} · ETA ${call.eta_minutes} min`
              : 'Awaiting dispatch…'}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes surge-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}
