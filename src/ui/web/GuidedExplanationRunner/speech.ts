/**
 * Speech playback for the GuidedExplanationRunner.
 *
 * Preferred path: Google Cloud TTS via `/api/tts/synthesize` (Neural2 voices,
 * native Hebrew support) played through an <audio> element with
 * `preservesPitch = true` so speed changes don't chipmunk the voice.
 *
 * Fallback path: browser `speechSynthesis`. Used only when the cloud call
 * fails (offline, unauthenticated, rate-limited, or returns no audio).
 *
 * Returns a handle compatible with the player's PausableAnimation contract so
 * pause/resume/cancel/setRate work uniformly across animation and audio.
 */

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
 * changes via `setRate()` work on the cloud-audio path. Browser-TTS fallback
 * ignores live rate changes — the next utterance picks up the new rate.
 */
export async function startSpeech(
  text: string,
  locale: string,
  rate: number,
): Promise<SpeechHandle> {
  const ttsLocale: 'he' | 'en' = locale === 'he' ? 'he' : 'en'
  const audioContent = await fetchCloudTTS(text, ttsLocale)
  if (audioContent) {
    return playCloudAudio(audioContent, rate)
  }
  return speakBrowser(text, locale, rate)
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

  const finished = new Promise<void>((resolve) => {
    const done = () => resolve()
    audio.onended = done
    audio.onerror = done
  })

  void audio.play().catch(() => undefined)

  return {
    finished,
    pause: () => {
      if (!cancelled && !audio.paused) audio.pause()
    },
    play: () => {
      if (!cancelled && audio.paused) void audio.play().catch(() => undefined)
    },
    cancel: () => {
      cancelled = true
      audio.pause()
      audio.src = ''
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
