import { AgentName, AgentState, AgentStatus } from '../types'

interface Props {
  agents: Record<AgentName, AgentState>
}

const SUBTITLES: Record<AgentName, string> = {
  MONITOR:  'Watching call volume',
  TRIAGE:   'Classifying incidents',
  RESOURCE: 'Allocating units',
  RELAY:    'Generating briefings',
}

const STATUS_DOT: Record<AgentStatus, string> = {
  IDLE:     'bg-slate-300',
  RUNNING:  'bg-blue-500 animate-pulse',
  COMPLETE: 'bg-green-500',
  ERROR:    'bg-red-500',
}

const AGENT_ORDER: AgentName[] = ['MONITOR', 'TRIAGE', 'RESOURCE', 'RELAY']

export default function AgentCards({ agents }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {AGENT_ORDER.map((name) => {
        const agent = agents[name]
        return (
          <div
            key={name}
            className="bg-white border border-slate-200 shadow-sm rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[agent.status]}`} />
              <span className="font-semibold text-slate-900 text-sm uppercase tracking-wide">
                {name}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2">{SUBTITLES[name]}</p>
            <p className="text-sm text-slate-500 line-clamp-2">{agent.last_action}</p>
          </div>
        )
      })}
    </div>
  )
}
