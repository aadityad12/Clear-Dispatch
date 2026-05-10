import { Call, Severity } from '../types'

interface Props {
  calls: Call[]
}

const BADGE: Record<Severity, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border border-red-200',
  URGENT:   'bg-amber-100 text-amber-800 border border-amber-200',
  STANDARD: 'bg-blue-100 text-blue-800 border border-blue-200',
  PENDING:  'bg-slate-100 text-slate-600',
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export default function CallQueue({ calls }: Props) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-lg flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="font-semibold text-slate-900 text-sm">Active Calls</span>
        <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full">
          {calls.length}
        </span>
      </div>

      <div className="overflow-y-auto max-h-[480px]">
        {calls.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No active calls</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {calls.map((call) => (
              <li key={call.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${BADGE[call.severity]}`}>
                    {call.severity}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-slate-500">{call.id}</span>
                      <span className="text-sm text-slate-900 font-medium">
                        {capitalize(call.incident_type)}
                      </span>
                      {call.vulnerable && (
                        <span className="text-amber-500 text-sm" title="Vulnerable caller">⚠️</span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mt-0.5">{call.zone}</p>

                    {call.unit_id && (
                      <p className="text-xs text-slate-500 mt-1">
                        Unit <span className="font-mono font-medium">{call.unit_id}</span>
                        {call.eta_minutes !== undefined && (
                          <span className="ml-1 text-slate-400">· ETA {call.eta_minutes}min</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
