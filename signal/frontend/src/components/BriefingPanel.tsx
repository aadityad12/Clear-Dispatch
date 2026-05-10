interface Props {
  briefing: { text: string; audio_url: string | null } | null
  onPlayAudio?: () => void
  audioBlocked?: boolean
}

export default function BriefingPanel({ briefing, onPlayAudio, audioBlocked }: Props) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-slate-400">🔈</span>
        <span className="font-semibold text-slate-900 text-sm">Latest Briefing</span>
      </div>

      {briefing === null ? (
        <p className="text-slate-400 text-sm">No briefings yet</p>
      ) : (
        <div className="space-y-3">
          <p className="font-medium text-slate-900 text-base leading-snug">{briefing.text}</p>

          {briefing.audio_url !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                🔊 Audio available
              </span>
              {audioBlocked && onPlayAudio && (
                <button
                  onClick={onPlayAudio}
                  className="text-xs text-blue-600 underline"
                >
                  ▶ Play briefing
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
