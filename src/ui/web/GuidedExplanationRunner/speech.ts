/**
 * Speech playback for the GuidedExplanationRunner.
 *
 * Path priority:
 *   1. Pre-fetched audio (`options.audioBase64`) — used when the lesson was
 *      cached with TTS already baked in by the server.
 *   2. Captions-only (`options.muted`) — runs a pauseable timer that resolves
 *      after an estimated duration so the sequence advances without sound.
 *   3. Google Cloud TTS via `/api/tts/synthesize` (Neural2 voices, native
 *      Hebrew support) played through an <audio> element with
 *      `preservesPitch = true` so speed changes don't chipmunk the voice.
 *   4. Browser `speechSynthesis` — fallback if the cloud call fails.
 *
 * Returns a handle compatible with the player's PausableAnimation contract so
 * pause/resume/cancel/setRate work uniformly across audio and silent timers.
 */

import { animate } from 'animejs'
import { pickVoiceForLocale } from '@/infra/utils/speechHelpers'

const HEBREW_NIQQUD_REGEX = /[֑-ׇ]/g

/** Strip Hebrew niqqud (vowel marks) from a string for display. */
export function stripNiqqud(text: string): string {
  return text.replace(HEBREW_NIQQUD_REGEX, '')
}

const LOCALE_TO_LANG: Record<string, string> = {
  he: 'he-IL',
  en: 'en-US',
}

export interface SpeechHandle {
  finished: Promise<void>
  pause: () => void
  play: () => void
  cancel: () => void
  setRate: (rate: number) => void
}

export interface StartSpeechOptions {
  /** Captions-only mode: no audio plays, sequence still advances on a timer. */
  muted?: boolean
  /**
   * Pre-fetched base64 MP3 from the lesson cache. When present, skips the
   * cloud TTS round-trip entirely.
   */
  audioBase64?: string | null
}

/** Warm up voice list — some browsers populate asynchronously. */
export function primeSpeechVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}

/** Cancel any in-flight speech. Safe to call from anywhere. */
export function cancelSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
}

/**
 * Start speech and return a handle whose `finished` promise resolves when
 * playback ends (or errors out). `rate` is applied at start; live rate
 * changes via `setRate()` work on the cloud-audio + muted paths. Browser-TTS
 * fallback ignores live rate changes — the next utterance picks up the new rate.
 */
export async function startSpeech(
  text: string,
  locale: string,
  rate: number,
  options: StartSpeechOptions = {},
): Promise<SpeechHandle> {
  // Captions-only mode wins over everything: even if audio is pre-cached, the
  // student has explicitly muted, so do not play it.
  if (options.muted) {
    return speakSilent(text, rate)
  }
  if (options.audioBase64) {
    return playCloudAudio(options.audioBase64, rate)
  }
  const ttsLocale: 'he' | 'en' = locale === 'he' ? 'he' : 'en'
  const audioContent = await fetchCloudTTS(text, ttsLocale)
  if (audioContent) {
    return playCloudAudio(audioContent, rate)
  }
  return speakBrowser(text, locale, rate)
}

// ---------------------------------------------------------------------------
// Captions-only — pauseable timer, no audio
// ---------------------------------------------------------------------------

/**
 * Estimate narration duration when no audio is playing. Calibrated so a
 * typical 1-2 sentence step lasts long enough for a student to read along.
 * Floor avoids snap-through on very short claims; cap prevents stalling on
 * runaway narrations.
 */
function estimateDurationMs(text: string): number {
  const charBudget = text.length * 60 // ~60ms per char ≈ moderate reading speed
  return Math.max(2000, Math.min(charBudget, 30_000))
}

function speakSilent(text: string, rate: number): SpeechHandle {
  const durationMs = estimateDurationMs(text)
  const anim = animate(
    { t: 0 },
    {
      t: 1,
      duration: durationMs,
      ease: 'linear',
    },
  )
  const a = anim as unknown as {
    pause: () => void
    play: () => void
    cancel?: () => void
    speed?: number
  }
  // Apply current rate so muted playback also respects the speed picker.
  a.speed = rate
  return {
    finished: anim as unknown as Promise<void>,
    pause: () => a.pause(),
    play: () => a.play(),
    cancel: () => a.cancel?.(),
    setRate: (nextRate: number) => {
      a.speed = nextRate
    },
  }
}

// ---------------------------------------------------------------------------
// Cloud TTS (Google Neural2 via existing /api/tts/synthesize endpoint)
// ---------------------------------------------------------------------------

async function fetchCloudTTS(text: string, locale: 'he' | 'en'): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    const response = await fetch('/api/tts/synthesize', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, locale }),
    })
    if (!response.ok) return null
    const { audioContent } = (await response.json()) as { audioContent?: string }
    return audioContent ?? null
  } catch {
    return null
  }
}

function playCloudAudio(base64: string, rate: number): SpeechHandle {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`)
  setPreservesPitch(audio, true)
  audio.playbackRate = rate
  let cancelled = false

  // Single resolver, idempotent — driven by whichever happens first:
  // the audio ending naturally, an error event, a real autoplay rejection
  // from the initial play() call, or an explicit cancel(). Without this
  // the runStep loop can hang forever if play() rejects (autoplay
  // blocked, decode failure that fires neither onended nor onerror).
  let resolveFinished: () => void = () => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })
  let settled = false
  const settle = () => {
    if (settled) return
    settled = true
    resolveFinished()
  }
  audio.onended = settle
  audio.onerror = settle

  /**
   * Calling audio.pause() while a play() promise is still in-flight rejects
   * that promise with AbortError. That is NOT a real failure — the caller
   * is mid-pause, the audio is paused, and we want to keep the handle live
   * so a later play() resumes from the same position. Filtering AbortError
   * here keeps a Pause-during-fetch from prematurely settling and silently
   * skipping the current step.
   */
  const onPlayRejected = (err: unknown) => {
    if ((err as { name?: string } | null | undefined)?.name === 'AbortError') return
    settle()
  }

  audio.play().catch(onPlayRejected)

  return {
    finished,
    pause: () => {
      if (!cancelled && !audio.paused) audio.pause()
    },
    play: () => {
      if (!cancelled && audio.paused) audio.play().catch(onPlayRejected)
    },
    cancel: () => {
      cancelled = true
      audio.pause()
      audio.src = ''
      settle()
    },
    setRate: (nextRate: number) => {
      if (!cancelled) audio.playbackRate = nextRate
    },
  }
}

/**
 * `preservesPitch` keeps voices natural at 2× speed instead of chipmunking
 * them. Browser prefixes differ; set all three so Chrome / Safari / Firefox
 * all honor it.
 */
function setPreservesPitch(audio: HTMLAudioElement, value: boolean): void {
  const a = audio as HTMLAudioElement & {
    mozPreservesPitch?: boolean
    webkitPreservesPitch?: boolean
  }
  a.preservesPitch = value
  a.mozPreservesPitch = value
  a.webkitPreservesPitch = value
}

// ---------------------------------------------------------------------------
// Browser speechSynthesis fallback
// ---------------------------------------------------------------------------

function speakBrowser(text: string, locale: string, rate: number): SpeechHandle {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return {
      finished: new Promise((r) => setTimeout(r, text.length * 80)),
      pause: () => undefined,
      play: () => undefined,
      cancel: () => undefined,
      setRate: () => undefined,
    }
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoiceForLocale(locale)
  if (voice) utterance.voice = voice
  else utterance.lang = LOCALE_TO_LANG[locale] ?? 'en-US'
  utterance.rate = 0.85 * rate
  utterance.pitch = 0.95

  const finished = new Promise<void>((resolve) => {
    utterance.onend = () => setTimeout(resolve, 400)
    utterance.onerror = () => setTimeout(resolve, 1500)
  })
  window.speechSynthesis.speak(utterance)

  return {
    finished,
    pause: () => window.speechSynthesis.pause(),
    play: () => window.speechSynthesis.resume(),
    cancel: () => window.speechSynthesis.cancel(),
    setRate: () => undefined,
  }
}
