import { useMemo } from 'react'
import { Call, Severity } from '../types'

interface Props {
  calls: Call[]
}

const SEV_RANK: Record<Severity, number> = { CRITICAL: 0, URGENT: 1, STANDARD: 2, PENDING: 3 }

export default function CallQueue({ calls }: Props) {
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
              <div key={call.id} className={`call-card ${call.severity.toLowerCase()}`}>
                <div className="call-row1">
                  <span className={`badge ${call.severity.toLowerCase()}`}>{call.severity}</span>
                  <span className="call-id">{call.id}</span>
                  {call.vulnerable && (
                    <span className="call-vuln" title="Vulnerable caller — priority response" aria-label="Vulnerable caller">⚠</span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span className="call-zone">{call.zone}</span>
                </div>
                <div className="call-incident">{call.incident_type}</div>
                {call.unit_id && (
                  <div className="call-unit">
                    <span className="dot" />
                    <span>Unit {call.unit_id} · ETA {call.eta_minutes} min</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
