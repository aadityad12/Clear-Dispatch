import { useState } from 'react'
import { Briefing } from '../types'

const DEFAULT_VISIBLE = 3

interface Props {
  briefings: Briefing[]
  audioBlocked?: boolean
  onPlayAudio?: () => void
}

export default function BriefingPanel({ briefings, audioBlocked, onPlayAudio }: Props) {
  const [expanded, setExpanded] = useState(false)

  const visible = expanded ? briefings : briefings.slice(0, DEFAULT_VISIBLE)
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-slate-400">🔈</span>
        <span className="font-semibold text-slate-900 text-sm">Briefings</span>
        {briefings.length > 0 && (
          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
            {briefings.length}
          </span>
        )}
      </div>

      {briefings.length === 0 ? (
        <p className="text-slate-400 text-sm">No briefings yet</p>
      ) : (
        <div className="space-y-0">
          {visible.map((b, i) => (
            <div
              key={`${b.call_id}-${b.timestamp}`}
              className={i > 0 ? 'border-t border-slate-100 pt-2 mt-2' : ''}
            >
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs text-slate-400 mt-0.5 shrink-0 tabular-nums">
                  {b.call_id}
                </span>
                <p
                  className={
                    i === 0
                      ? 'font-medium text-slate-900 text-base leading-snug'
                      : 'text-sm text-slate-500 leading-snug'
                  }
                >
                  {b.text}
                </p>
              </div>

              {i === 0 && (
                <div className="flex items-center gap-2 mt-1.5 pl-[3.25rem]">
                  {b.audio_url !== null && (
                    <span className="text-xs font-semibold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                      🔊 Audio
                    </span>
                  )}
                  {audioBlocked && onPlayAudio && (
                    <button onClick={onPlayAudio} className="text-xs text-blue-600 underline">
                      ▶ Play briefing
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {briefings.length > DEFAULT_VISIBLE && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {expanded ? 'Show less' : `Show all ${briefings.length} briefings`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
