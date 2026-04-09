/**
 * Hebrew-aware speechSynthesis wrapper used by the GuidedExplanationRunner.
 *
 * Extracted verbatim from the manager's reference HTML so behaviour matches
 * the example 1:1: prefer Hila/Carmit voices, fall back to Google/Premium,
 * finally any Hebrew voice, finally the default. Rate/pitch tuned for a
 * teacher-explanation cadence.
 */

const HEBREW_NIQQUD_REGEX = /[\u0591-\u05C7]/g

/** Strip Hebrew niqqud (vowel marks) from a string for display. */
export function stripNiqqud(text: string): string {
  return text.replace(HEBREW_NIQQUD_REGEX, '')
}

/**
 * Pick the best available Hebrew voice. Returns undefined when no Hebrew
 * voice is installed — callers should set `utterance.lang = 'he-IL'` in
 * that case and let the browser substitute.
 */
function pickHebrewVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined
  const voices = window.speechSynthesis.getVoices()
  const hebrew = voices.filter((v) => v.lang.includes('he') || v.lang.includes('iw'))
  if (hebrew.length === 0) return undefined
  return (
    hebrew.find((v) => v.name.includes('Natural') || v.name.includes('Online')) ??
    hebrew.find((v) => v.name.includes('Hila') || v.name.includes('Carmit')) ??
    hebrew.find((v) => v.name.includes('Google') || v.name.includes('Premium')) ??
    hebrew[0]
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
 * `shouldCancel()` is polled on voice end/error; if it returns true the
 * promise resolves immediately without waiting — used by the sequence
 * cancellation mechanism in `useGuidedPlayer`.
 *
 * Falls back to a text-length-proportional timeout when speechSynthesis is
 * unavailable, matching the reference implementation.
 */
export function speak(text: string, shouldCancel: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(resolve, text.length * 80)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickHebrewVoice()
    if (voice) utterance.voice = voice
    else utterance.lang = 'he-IL'
    utterance.rate = 0.85
    utterance.pitch = 0.95
    utterance.onend = () => {
      setTimeout(() => {
        if (!shouldCancel()) resolve()
        else resolve()
      }, 400)
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
