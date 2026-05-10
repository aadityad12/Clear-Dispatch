import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Call, Severity, Briefing } from '../types'

interface Props {
  calls: Call[]
  briefings: Briefing[]
  onShowOnMap?: (lat: number, lon: number) => void
}

const SEV_RANK: Record<Severity, number> = { CRITICAL: 0, URGENT: 1, STANDARD: 2, PENDING: 3 }

function getPipelineStatus(call: Call): 'triaging' | 'routing' | null {
  if (call.severity === 'PENDING') return 'triaging'
  if (!call.unit_id) return 'routing'
  return null
}

function PipelineChip({ status }: { status: 'triaging' | 'routing' }) {
  const isTriaging = status === 'triaging'
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.08em',
      color: isTriaging ? '#f59e0b' : '#60a5fa',
      background: isTriaging ? 'rgba(245,158,11,0.1)' : 'rgba(96,165,250,0.1)',
      border: `1px solid ${isTriaging ? 'rgba(245,158,11,0.3)' : 'rgba(96,165,250,0.3)'}`,
      borderRadius: 3,
      padding: '2px 7px',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: isTriaging ? '#f59e0b' : '#60a5fa',
        display: 'inline-block',
        animation: 'pipeline-pulse 1.2s ease-in-out infinite',
      }} />
      {isTriaging ? 'TRIAGING' : 'ROUTING'}
    </div>
  )
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function CallCard({
  call,
  briefing,
  onShowOnMap,
}: {
  call: Call
  briefing: Briefing | undefined
  onShowOnMap?: (lat: number, lon: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (call.severity === 'CRITICAL' && call.live) setExpanded(true)
  }, [call.severity, call.live])

  useEffect(() => {
    if (expanded && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [call.transcript, expanded])

  const pipelineStatus = getPipelineStatus(call)
  const hasDetails = !!(
    call.live_fields?.location || call.live_fields?.one_liner || call.live_fields?.caller_status ||
    call.live_fields?.hazards?.length || call.live_fields?.people_affected != null ||
    call.transcript || briefing || call.unit_id
  )

  return (
    <div
      className={`call-card ${call.severity.toLowerCase()}`}
      style={{ cursor: 'pointer' }}
      onClick={() => setExpanded((e) => !e)}
    >
      {/* Row 1 */}
      <div className="call-row1">
        <span className={`badge ${call.severity.toLowerCase()}`}>{call.severity}</span>
        <span className="call-id">{call.id}</span>
        {call.vulnerable && (
          <span className="call-vuln" title="Vulnerable caller" aria-label="Vulnerable caller">⚠</span>
        )}
        {call.live && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4, fontSize: 10, fontWeight: 700, color: '#ef4444', letterSpacing: '0.05em' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
            LIVE
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span className="call-zone">{call.zone}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Incident type */}
      <div className="call-incident">{call.incident_type}</div>

      {/* Pipeline status chip */}
      {pipelineStatus && <PipelineChip status={pipelineStatus} />}

      {/* Unit row */}
      {call.unit_id && (
        <div className="call-unit">
          <span className="dot" />
          <span>Unit {call.unit_id} · ETA {call.eta_minutes} min</span>
        </div>
      )}

      {/* Show on map */}
      {call.lat != null && onShowOnMap && (
        <button
          className="call-show-map"
          onClick={(e) => { e.stopPropagation(); onShowOnMap(call.lat!, call.lon!) }}
        >
          ↗ Show on map
        </button>
      )}

      {/* Detail drawer */}
      {expanded && (
        <div
          style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          {!hasDetails && (
            <div style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic' }}>
              Details will appear as agents process this call…
            </div>
          )}

          {/* Location */}
          {(call.live_fields?.location || call.zone) && (
            <DetailSection label="Location">
              <div style={{ fontSize: 12, color: '#d1d5db' }}>
                {call.live_fields?.location || call.zone}
                {call.lat != null && (
                  <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 6 }}>
                    {call.lat.toFixed(4)}°N {Math.abs(call.lon!).toFixed(4)}°W
                  </span>
                )}
              </div>
            </DetailSection>
          )}

          {/* Situation */}
          {(call.live_fields?.one_liner || call.live_fields?.caller_status || call.live_fields?.people_affected != null) && (
            <DetailSection label="Situation">
              {call.live_fields?.one_liner && (
                <div style={{ fontSize: 12, color: '#d1d5db', marginBottom: 4 }}>{call.live_fields.one_liner}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {call.live_fields?.caller_status && (
                  <span style={pill('#3b1f1f', '#f87171')}>{call.live_fields.caller_status}</span>
                )}
                {call.live_fields?.people_affected != null && (
                  <span style={pill('#1f2937', '#9ca3af')}>{call.live_fields.people_affected} affected</span>
                )}
              </div>
            </DetailSection>
          )}

          {/* Hazards */}
          {Array.isArray(call.live_fields?.hazards) && call.live_fields!.hazards!.length > 0 && (
            <DetailSection label="Hazards">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {call.live_fields!.hazards!.map((h) => (
                  <span key={h} style={pill('#2d1f0a', '#fb923c')}>⚠ {h}</span>
                ))}
              </div>
            </DetailSection>
          )}

          {/* Response */}
          {(call.unit_id || briefing) && (
            <DetailSection label="Response">
              {call.unit_id && (
                <div style={{ fontSize: 12, color: '#4ade80', marginBottom: briefing ? 6 : 0 }}>
                  Unit {call.unit_id} dispatched · ETA {call.eta_minutes} min
                </div>
              )}
              {briefing && (
                <div style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5 }}>{briefing.text}</div>
              )}
            </DetailSection>
          )}

          {/* Transcript */}
          {call.transcript && (
            <DetailSection label="Call transcript">
              <div
                ref={transcriptRef}
                style={{
                  maxHeight: 120,
                  overflowY: 'auto',
                  fontSize: 11,
                  color: '#9ca3af',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 4,
                  padding: '6px 8px',
                }}
              >
                {call.transcript}
              </div>
            </DetailSection>
          )}
        </div>
      )}
    </div>
  )
}

function pill(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }
}

export default function CallQueue({ calls, briefings, onShowOnMap }: Props) {
  const sorted = useMemo(() => {
    return [...calls].sort((a, b) => {
      const r = SEV_RANK[a.severity] - SEV_RANK[b.severity]
      return r !== 0 ? r : (b._t || 0) - (a._t || 0)
    })
  }, [calls])

  const briefingMap = useMemo(() => {
    const m: Record<string, Briefing> = {}
    for (const b of briefings) m[b.call_id] = b
    return m
  }, [briefings])

  return (
    <div className="panel" aria-label="Active calls">
      <div className="panel-title">
        <span>Active Calls</span>
        <span className="count">{calls.length}</span>
      </div>
      <div className="panel-body scroll-fade">
        {calls.length === 0 ? (
          <div className="empty-state">
            <div className="radio-icon" aria-hidden>📡</div>
            <div>No active calls</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>System monitoring 24 incoming channels</div>
          </div>
        ) : (
          <div className="call-list">
            {sorted.map((call) => (
              <CallCard
                key={call.id}
                call={call}
                briefing={briefingMap[call.id]}
                onShowOnMap={onShowOnMap}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
        @keyframes pipeline-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.6); }
        }
      `}</style>
    </div>
  )
}
