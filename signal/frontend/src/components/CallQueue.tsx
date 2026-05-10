import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Call, Severity } from '../types'

interface Props {
  calls: Call[]
  onShowOnMap?: (lat: number, lon: number) => void
}

const SEV_RANK: Record<Severity, number> = { CRITICAL: 0, URGENT: 1, STANDARD: 2, PENDING: 3 }

function CallCard({ call, onShowOnMap }: { call: Call; onShowOnMap?: (lat: number, lon: number) => void }) {
  const autoExpand = call.severity === 'CRITICAL' && call.live === true
  const [expanded, setExpanded] = useState(autoExpand)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Auto-expand when CRITICAL + live
  useEffect(() => {
    if (autoExpand) setExpanded(true)
  }, [autoExpand])

  // Auto-scroll transcript to bottom when it updates
  useEffect(() => {
    if (expanded && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [call.transcript, expanded])

  const hasExpandable = call.live && (call.transcript || call.live_fields)

  return (
    <div
      className={`call-card ${call.severity.toLowerCase()}`}
      style={{ cursor: hasExpandable ? 'pointer' : 'default' }}
      onClick={() => { if (hasExpandable) setExpanded((e) => !e) }}
    >
      <div className="call-row1">
        <span className={`badge ${call.severity.toLowerCase()}`}>{call.severity}</span>
        <span className="call-id">{call.id}</span>
        {call.vulnerable && (
          <span className="call-vuln" title="Vulnerable caller — priority response" aria-label="Vulnerable caller">⚠</span>
        )}
        {call.live && (
          <span
            className="live-badge"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4, fontSize: 10, fontWeight: 700, color: '#ef4444', letterSpacing: '0.05em' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#ef4444',
                display: 'inline-block',
                animation: 'pulse-dot 1.2s ease-in-out infinite',
              }}
            />
            LIVE
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span className="call-zone">{call.zone}</span>
        {hasExpandable && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>
      <div className="call-incident">{call.incident_type}</div>
      {call.unit_id && (
        <div className="call-unit">
          <span className="dot" />
          <span>Unit {call.unit_id} · ETA {call.eta_minutes} min</span>
        </div>
      )}
      {call.lat != null && onShowOnMap && (
        <button
          className="call-show-map"
          onClick={(e) => { e.stopPropagation(); onShowOnMap(call.lat!, call.lon!) }}
        >
          ↗ Show on map
        </button>
      )}

      {expanded && call.live && (
        <div
          style={{
            marginTop: 8,
            background: 'rgba(0,0,0,0.25)',
            borderRadius: 6,
            padding: '8px 10px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.08em' }}>
            LIVE TRANSCRIPT
          </div>
          {call.transcript && (
            <div
              ref={transcriptRef}
              style={{
                maxHeight: 100,
                overflowY: 'auto',
                fontSize: 12,
                color: '#d1d5db',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                marginBottom: 6,
              }}
            >
              {call.transcript}
            </div>
          )}
          {call.live_fields && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {call.live_fields.location && (
                <span style={pillStyle('#1e3a5f', '#60a5fa')}>
                  📍 {call.live_fields.location}
                </span>
              )}
              {call.live_fields.caller_status && (
                <span style={pillStyle('#3b1f1f', '#f87171')}>
                  {call.live_fields.caller_status}
                </span>
              )}
              {call.live_fields.people_affected != null && (
                <span style={pillStyle('#1f2937', '#9ca3af')}>
                  {call.live_fields.people_affected} affected
                </span>
              )}
              {call.live_fields.hazards?.map((h) => (
                <span key={h} style={pillStyle('#2d1f0a', '#fb923c')}>
                  ⚠ {h}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function pillStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 10,
    whiteSpace: 'nowrap',
  }
}

export default function CallQueue({ calls, onShowOnMap }: Props) {
  const sorted = useMemo(() => {
    return [...calls].sort((a, b) => {
      const r = SEV_RANK[a.severity] - SEV_RANK[b.severity]
      return r !== 0 ? r : (b._t || 0) - (a._t || 0)
    })
  }, [calls])

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
              <CallCard key={call.id} call={call} onShowOnMap={onShowOnMap} />
            ))}
          </div>
        )}
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
