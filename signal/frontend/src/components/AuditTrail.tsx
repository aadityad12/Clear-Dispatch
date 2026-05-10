import { useState } from 'react'
import { AuditEntry } from '../types'

interface Props {
  entries: AuditEntry[]
}

export default function AuditTrail({ entries }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white border-t border-slate-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold">
          Audit Trail
          <span className="ml-2 text-xs font-normal text-slate-400">({entries.length} entries)</span>
        </span>
        <span className="text-slate-400 text-xs">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>

      {open && (
        <div className="max-h-48 overflow-y-auto border-t border-slate-100">
          {entries.length === 0 ? (
            <p className="text-slate-400 text-sm px-6 py-4">No activity yet</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {entries.map((entry, i) => (
                <li key={i} className="flex items-start gap-3 px-6 py-2">
                  <span className="font-mono text-xs text-slate-400 mt-0.5 flex-shrink-0 w-44">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">
                    {entry.type}
                  </span>
                  <span className="text-sm text-slate-700 min-w-0">{entry.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
