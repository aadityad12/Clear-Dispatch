import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Call, Severity, CallStatus } from '../types'

interface Props {
  calls: Call[]
  onShowOnMap?: (lat: number, lon: number) => void
  onSelectCall?: (callId: string) => void
}

const SEV_RANK: Record<Severity, number> = { CRITICAL: 0, URGENT: 1, STANDARD: 2, PENDING: 3 }

function statusBadgeStyle(status: CallStatus): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 10,
    letterSpacing: '0.06em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  }
  switch (status) {
    case 'RINGING':
      return { ...base, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }
    case 'ACTIVE':
      return { ...base, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }
    case 'PROCESSING':
      return { ...base, background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.4)' }
    case 'DISPATCHED':
      return { ...base, background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)' }
  }
}

function CallCard({
  call,
  onShowOnMap,
  onSelectCall,
}: {
  call: Call
  onShowOnMap?: (lat: number, lon: number) => void
  onSelectCall?: (callId: string) => void
}) {
  const isInteractive = call.call_status === 'RINGING' || call.call_status === 'ACTIVE'
  const autoExpand = !isInteractive && call.severity === 'CRITICAL' && call.live === true
  const [expanded, setExpanded] = useState(autoExpand)
  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoExpand) setExpanded(true)
  }, [autoExpand])

  useEffect(() => {
    if (expanded && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [call.transcript, expanded])

  const hasLiveExpandable = !isInteractive && call.live && (call.transcript || call.live_fields)
  const hasExpandable = hasLiveExpandable

  const handleClick = () => {
    if (isInteractive && onSelectCall) {
      onSelectCall(call.id)
    } else if (!isInteractive && onSelectCall) {
      onSelectCall(call.id)
    } else if (hasExpandable) {
      setExpanded((e) => !e)
    }
  }

  return (
    <div
      className={`call-card ${call.severity.toLowerCase()}`}
      style={{ cursor: isInteractive || hasExpandable || onSelectCall ? 'pointer' : 'default' }}
      onClick={handleClick}
    >
      <div className="call-row1">
        <span className={`badge ${call.severity.toLowerCase()}`}>{call.severity}</span>
        {call.call_status && call.call_status !== 'DISPATCHED' && (
          <span style={statusBadgeStyle(call.call_status)}>
            {call.call_status === 'RINGING' && (
              <span style={{ fontSize: 9 }}>📞</span>
            )}
            {call.call_status === 'ACTIVE' && (
              <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#ef4444',
                display: 'inline-block',
                animation: 'pulse-dot 1.2s ease-in-out infinite',
                flexShrink: 0,
              }} />
            )}
            {call.call_status}
          </span>
        )}
        {call.call_status === 'DISPATCHED' && (
          <span style={statusBadgeStyle('DISPATCHED')}>DISPATCHED</span>
        )}
        <span className="call-id">{call.id}</span>
        {call.vulnerable && (
          <span className="call-vuln" title="Vulnerable caller — priority response" aria-label="Vulnerable caller">⚠</span>
        )}
        {call.live && !isInteractive && (
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
        {hasLiveExpandable && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
        {(isInteractive || (!isInteractive && onSelectCall && !hasLiveExpandable)) && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>→</span>
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

      {expanded && call.live && !isInteractive && (
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

export default function CallQueue({ calls, onShowOnMap, onSelectCall }: Props) {
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
              <CallCard key={call.id} call={call} onShowOnMap={onShowOnMap} onSelectCall={onSelectCall} />
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
