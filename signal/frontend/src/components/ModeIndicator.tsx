import { Mode } from '../types'

interface Props {
  mode: Mode
  connected: boolean
}

export default function ModeIndicator({ mode, connected }: Props) {
  const isSurge = mode === 'SURGE'

  return (
    <div
      className={`flex items-center justify-between px-6 h-12 transition-colors duration-300 ${
        isSurge ? 'bg-red-600' : 'bg-blue-700'
      } text-white`}
    >
      <div className="flex items-center gap-3">
        {isSurge && (
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
        )}
        <span className="font-semibold text-sm tracking-wide">
          {isSurge
            ? '⚡ SURGE MODE ACTIVE — AI agents are triaging and routing'
            : 'ASSISTED MODE — AI is supporting. Dispatcher in control.'}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            connected ? 'bg-green-400' : 'bg-slate-400'
          }`}
        />
        <span className="opacity-80">{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </div>
  )
}
