interface Props {
  briefing: { call_id?: string; text: string; audio_url: string | null } | null
  audioBlocked?: boolean
  onPlayAudio?: () => void
}

export default function BriefingPanel({ briefing, audioBlocked, onPlayAudio }: Props) {
  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="panel-title">
        <span>🔊 Latest Briefing</span>
        {briefing && <span className="briefing-callid">{briefing.call_id ?? ''}</span>}
      </div>
      <div className="panel-body">
        {!briefing ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <div style={{ fontSize: 28, opacity: 0.4 }}>🎙</div>
            <div style={{ fontSize: 12 }}>No briefings yet</div>
          </div>
        ) : (
          <div className="briefing-body">
            <div className="briefing-text">{briefing.text}</div>
            <div className="briefing-meta">
              {briefing.audio_url !== null && !audioBlocked && (
                <span className="audio-badge">🔊 Audio available</span>
              )}
              {briefing.audio_url !== null && audioBlocked && onPlayAudio && (
                <button className="play-button" onClick={onPlayAudio}>▶ Play Briefing</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
