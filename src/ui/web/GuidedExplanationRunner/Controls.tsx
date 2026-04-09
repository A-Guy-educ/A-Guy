interface ControlsProps {
  playLabel: string
  resetLabel: string
  isPlaying: boolean
  onPlay: () => void
  onReset: () => void
}

export function Controls({ playLabel, resetLabel, isPlaying, onPlay, onReset }: ControlsProps) {
  return (
    <div className="ge-controls">
      <button type="button" className="ge-btn ge-btn-primary" onClick={onPlay} disabled={isPlaying}>
        {playLabel}
      </button>
      <button type="button" className="ge-btn ge-btn-secondary" onClick={onReset}>
        {resetLabel}
      </button>
    </div>
  )
}
