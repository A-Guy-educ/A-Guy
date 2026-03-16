'use client'
/**
 * @fileType component
 * @domain cody
 * @pattern voice-ui
 * @ai-summary Full-screen voice conversation overlay with state indicators and controls
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Loader2, Volume2 } from 'lucide-react'
import { cn } from '@/infra/utils/ui'
import type { VoiceChatState } from '../hooks/useVoiceChat'

interface VoiceChatOverlayProps {
  state: VoiceChatState
  currentTranscript: string
  turnCount: number
  error: string | null
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  agentName: string
  onStop: () => void
  onToggleMute: () => void
  isMuted: boolean
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VoiceChatOverlay({
  state,
  currentTranscript,
  turnCount,
  error,
  messages,
  agentName,
  onStop,
  onToggleMute,
  isMuted,
}: VoiceChatOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onStop()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onStop])

  const handleTabTrap = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !overlayRef.current) return
    const els = overlayRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (els.length === 0) return
    if (e.shiftKey && document.activeElement === els[0]) {
      e.preventDefault()
      els[els.length - 1].focus()
    } else if (!e.shiftKey && document.activeElement === els[els.length - 1]) {
      e.preventDefault()
      els[0].focus()
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleTabTrap)
    return () => window.removeEventListener('keydown', handleTabTrap)
  }, [handleTabTrap])
  useEffect(() => {
    overlayRef.current?.focus()
  }, [])

  const recent = messages.slice(-6)

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Voice chat conversation"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      <div className="absolute top-6 left-0 right-0 text-center">
        <h2 className="text-lg font-semibold">🎤 Voice Chat</h2>
        <p className="text-sm text-muted-foreground">with {agentName}</p>
      </div>

      <div className="w-full max-w-md px-4 mb-8 max-h-[30vh] overflow-y-auto">
        {recent.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'mb-2 px-3 py-2 rounded-lg text-sm max-w-[85%]',
              msg.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'mr-auto bg-muted',
            )}
          >
            <span className="font-medium text-xs opacity-70 block mb-0.5">
              {msg.role === 'user' ? 'You' : 'Cody'}
            </span>
            <span className="line-clamp-3">{msg.content}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 mb-12">
        <div
          className={cn(
            'relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300',
            state === 'listening' && 'bg-primary/10',
            state === 'processing' && 'bg-amber-500/10',
            state === 'speaking' && 'bg-green-500/10',
          )}
        >
          {state === 'listening' && !isMuted && (
            <>
              <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <span
                className="absolute inset-2 rounded-full bg-primary/15 animate-ping"
                style={{ animationDelay: '0.3s' }}
              />
            </>
          )}
          {state === 'listening' && (
            <Mic
              className={cn(
                'w-10 h-10 relative z-10 transition-colors',
                isMuted ? 'text-muted-foreground' : 'text-primary',
              )}
            />
          )}
          {state === 'processing' && (
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin relative z-10" />
          )}
          {state === 'speaking' && (
            <Volume2 className="w-10 h-10 text-green-500 animate-pulse relative z-10" />
          )}
        </div>
        <div aria-live="polite" className="text-center">
          {state === 'listening' && !isMuted && (
            <p className="text-base font-medium text-primary">Listening...</p>
          )}
          {state === 'listening' && isMuted && (
            <p className="text-base font-medium text-muted-foreground">Muted</p>
          )}
          {state === 'processing' && (
            <p className="text-base font-medium text-amber-500">Thinking...</p>
          )}
          {state === 'speaking' && (
            <p className="text-base font-medium text-green-500">Speaking...</p>
          )}
        </div>
        {state === 'listening' && currentTranscript && (
          <div className="px-4 py-2 bg-muted rounded-lg max-w-sm text-center">
            <p className="text-sm italic text-muted-foreground">
              &ldquo;{currentTranscript}&rdquo;
            </p>
          </div>
        )}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg max-w-sm text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={onToggleMute}
          className={cn(
            'flex items-center justify-center w-14 h-14 rounded-full transition-colors',
            isMuted
              ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
          )}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button
          type="button"
          onClick={onStop}
          className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          aria-label="End voice chat"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-xs text-muted-foreground">
          Turn {turnCount} · {formatElapsed(elapsed)} elapsed · Press{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> to end
        </p>
      </div>
    </div>
  )
}
