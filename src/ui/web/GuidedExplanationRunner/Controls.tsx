import { Volume2, VolumeX } from 'lucide-react'

interface ControlsProps {
  playLabel: string
  resetLabel: string
  pauseLabel: string
  resumeLabel: string
  speedLabel: string
  soundOnLabel: string
  soundOffLabel: string
  isPlaying: boolean
  isPaused: boolean
  speed: number
  soundOn: boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
  onSpeedChange: (rate: number) => void
  onToggleSound: () => void
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.5, 2] as const

function formatSpeed(rate: number): string {
  return `${rate}×`
}

export function Controls({
  playLabel,
  resetLabel,
  pauseLabel,
  resumeLabel,
  speedLabel,
  soundOnLabel,
  soundOffLabel,
  isPlaying,
  isPaused,
  speed,
  soundOn,
  onPlay,
  onPause,
  onResume,
  onReset,
  onSpeedChange,
  onToggleSound,
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
      <button
        type="button"
        className={`ge-sound-btn${soundOn ? '' : ' ge-sound-btn-off'}`}
        onClick={onToggleSound}
        aria-pressed={!soundOn}
        aria-label={soundOn ? soundOnLabel : soundOffLabel}
        title={soundOn ? soundOnLabel : soundOffLabel}
      >
        {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>
      <div className="ge-speed-group" role="group" aria-label={speedLabel}>
        {SPEED_OPTIONS.map((rate) => (
          <button
            key={rate}
            type="button"
            className={`ge-speed-btn${rate === speed ? ' ge-speed-btn-active' : ''}`}
            onClick={() => onSpeedChange(rate)}
            aria-pressed={rate === speed}
          >
            {formatSpeed(rate)}
          </button>
        ))}
      </div>
    </div>
  )
}
