interface ControlsProps {
  playLabel: string
  resetLabel: string
  pauseLabel: string
  resumeLabel: string
  isPlaying: boolean
  isPaused: boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
}

export function Controls({
  playLabel,
  resetLabel,
  pauseLabel,
  resumeLabel,
  isPlaying,
  isPaused,
  onPlay,
  onPause,
  onResume,
  onReset,
}: ControlsProps) {
  // Three states:
  //   - idle (not playing) → show Play
  //   - playing + not paused → show Pause
  //   - playing + paused → show Resume
  const primary = !isPlaying ? (
    <button type="button" className="ge-btn ge-btn-primary" onClick={onPlay}>
      {playLabel}
    </button>
  ) : isPaused ? (
    <button type="button" className="ge-btn ge-btn-primary" onClick={onResume}>
      {resumeLabel}
    </button>
  ) : (
    <button type="button" className="ge-btn ge-btn-primary" onClick={onPause}>
      {pauseLabel}
    </button>
  )

  return (
    <div className="ge-controls">
      {primary}
      <button type="button" className="ge-btn ge-btn-secondary" onClick={onReset}>
        {resetLabel}
      </button>
    </div>
  )
}
