/**
 * Locale-aware speechSynthesis wrapper used by the GuidedExplanationRunner.
 *
 * For Hebrew: prefers Hila/Carmit voices, falls back to Google/Premium,
 * then any Hebrew voice, finally the browser default. Rate/pitch tuned
 * for a teacher-explanation cadence.
 */

const HEBREW_NIQQUD_REGEX = /[\u0591-\u05C7]/g

/** Strip Hebrew niqqud (vowel marks) from a string for display. */
export function stripNiqqud(text: string): string {
  return text.replace(HEBREW_NIQQUD_REGEX, '')
}

const LOCALE_TO_LANG: Record<string, string> = {
  he: 'he-IL',
  en: 'en-US',
}

function pickVoiceForLocale(locale: string): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = locale === 'he' ? ['he', 'iw'] : [locale]
  const matching = voices.filter((v) => langPrefix.some((p) => v.lang.includes(p)))
  if (matching.length === 0) return undefined
  if (locale === 'he') {
    return (
      matching.find((v) => v.name.includes('Natural') || v.name.includes('Online')) ??
      matching.find((v) => v.name.includes('Hila') || v.name.includes('Carmit')) ??
      matching.find((v) => v.name.includes('Google') || v.name.includes('Premium')) ??
      matching[0]
    )
  }
  return (
    matching.find((v) => v.name.includes('Natural') || v.name.includes('Google')) ?? matching[0]
  )
}

/** Warm up voice list — some browsers populate asynchronously. */
export function primeSpeechVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}

/**
 * Speak `text` and resolve when the utterance finishes (or errors).
 *
 * Falls back to a text-length-proportional timeout when speechSynthesis is
 * unavailable, matching the reference implementation.
 */
export function speak(text: string, locale: string, _shouldCancel: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(resolve, text.length * 80)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickVoiceForLocale(locale)
    if (voice) utterance.voice = voice
    else utterance.lang = LOCALE_TO_LANG[locale] ?? 'en-US'
    utterance.rate = 0.85
    utterance.pitch = 0.95
    utterance.onend = () => {
      setTimeout(resolve, 400)
    }
    utterance.onerror = () => {
      setTimeout(resolve, 1500)
    }
    window.speechSynthesis.speak(utterance)
  })
}

/** Cancel any in-flight speech. Safe to call from anywhere. */
export function cancelSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
}
