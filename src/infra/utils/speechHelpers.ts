/**
 * @fileType utility
 * @domain shared
 * @pattern text-processing
 * @ai-summary Shared helpers for speech synthesis: markdown stripping and language detection
 */

import { latexToSpeech, type SupportedLocale } from './latexToSpeech'
import { normalizeLatexDelimiters } from '@/infra/utils/normalize-latex'

/**
 * Convert LaTeX math expressions within text to spoken equivalents,
 * then strip remaining markdown formatting.
 *
 * Handles both inline ($...$) and block ($$...$$) math, converting them
 * to natural spoken text using latexToSpeech before removing other markup.
 */
export function stripMarkdown(text: string, locale: SupportedLocale = 'en'): string {
  // Normalize LLM-style delimiters (\[...\], \(...\)) to $$...$$ / $...$
  // so the math-to-speech regex below can find them
  let result = normalizeLatexDelimiters(text)

  // Convert block math $$...$$ to spoken text
  // Use [\s\S] instead of [^$] to match newlines added by normalizeLatexDelimiters
  result = result.replace(/\n?\$\$\n?([\s\S]+?)\n?\$\$\n?/g, (_, latex) => {
    const spoken = latexToSpeech(latex.trim(), locale)
    return spoken ? ` ${spoken} ` : ''
  })

  // Convert inline math $...$ to spoken text
  result = result.replace(/\$([^$]+)\$/g, (_, latex) => {
    const spoken = latexToSpeech(latex.trim(), locale)
    return spoken ? ` ${spoken} ` : ''
  })

  // Strip remaining markdown formatting
  return result
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\\[a-zA-Z]+(\{[^}]*\})*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*{1,2}|_{1,2})(.*?)\1/g, '$2')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/^---+$/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Pick the best speech synthesis voice for the given locale.
 * Prefers Natural/Online voices, then Hila/Carmit for Hebrew, then Google/Premium.
 */
export function pickVoiceForLocale(locale: string): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = locale === 'he' ? ['he', 'iw'] : [locale]
  const matching = voices.filter((v) => langPrefix.some((p) => v.lang.startsWith(p)))
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

/** Detect if text is primarily Hebrew based on character frequency. */
export function detectLanguage(text: string): 'he-IL' | 'en-US' {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length
  return hebrewChars > latinChars ? 'he-IL' : 'en-US'
}

/** Check if the browser has a native speech synthesis voice for the given locale. */
export function hasNativeVoiceForLocale(locale: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = locale === 'he' ? ['he', 'iw'] : [locale]
  return voices.some((v) => langPrefix.some((p) => v.lang.startsWith(p)))
}
