import { useState, useEffect } from 'react'
import { AuditEntry } from '../types'

interface Props {
  entries: AuditEntry[]
}

export default function AuditTrail({ entries }: Props) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'a' || e.key === 'A') {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="audit-bar">
      <div
        className="audit-head"
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v) } }}
      >
        <span>Audit Trail <span style={{ color: 'var(--text-muted)' }}>({entries.length})</span></span>
        <div className="right">
          <span className="kbd">A</span>
          <span>{open ? '▲ Collapse' : '▼ Expand'}</span>
        </div>
      </div>
      {open && (
        <div className="audit-list">
          {entries.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
              No events yet — start the demo to see live activity.
            </div>
          ) : (
            entries.map((entry, i) => (
              <div className="audit-row" key={i}>
                <span className="audit-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className={`audit-tag ${entry.type}`}>{entry.type}</span>
                <span className="audit-summary">{entry.summary}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
