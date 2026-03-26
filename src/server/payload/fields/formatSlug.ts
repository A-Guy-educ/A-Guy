import slugify from 'slugify'

import { containsHebrew, translateHebrewForSlug } from './translateForSlug'

/**
 * Hebrew-to-Latin transliteration map.
 * Used as fallback when translation API is unavailable.
 */
const HEBREW_MAP: Record<string, string> = {
  א: '',
  ב: 'b',
  ג: 'g',
  ד: 'd',
  ה: 'h',
  ו: 'v',
  ז: 'z',
  ח: 'ch',
  ט: 't',
  י: 'y',
  כ: 'k',
  ך: 'k',
  ל: 'l',
  מ: 'm',
  ם: 'm',
  נ: 'n',
  ן: 'n',
  ס: 's',
  ע: 'a',
  פ: 'p',
  ף: 'f',
  צ: 'ts',
  ץ: 'ts',
  ק: 'k',
  ר: 'r',
  ש: 'sh',
  ת: 't',
}

/**
 * Transliterate Hebrew characters to Latin equivalents.
 * Non-Hebrew characters (including spaces, numbers, Latin letters) are kept as-is.
 * Hebrew niqqud (diacritics, U+0591–U+05C7) are stripped.
 */
function transliterateHebrew(input: string): string {
  const stripped = input.replace(/[\u0591-\u05C7]/g, '')

  let result = ''
  for (const char of stripped) {
    if (char in HEBREW_MAP) {
      result += HEBREW_MAP[char]
    } else {
      result += char
    }
  }
  return result
}

function toSlug(input: string, fallback?: string): string {
  const slug = slugify(input, {
    lower: true,
    strict: true,
    remove: /[*#@]/g,
  })

  if (!slug && fallback) {
    return fallback
  }

  if (!slug) {
    return `item-${Date.now().toString(36)}`
  }

  return slug
}

/**
 * Synchronous slug formatting with transliteration fallback.
 * Use formatSlugAsync when possible for better Hebrew support via translation.
 */
export function formatSlug(input: string, fallback?: string): string {
  const transliterated = transliterateHebrew(input.trim())
  return toSlug(transliterated, fallback)
}

/**
 * Async slug formatting that translates Hebrew titles to English via OpenAI.
 * Falls back to transliteration if translation fails or API is unavailable.
 */
export async function formatSlugAsync(input: string, fallback?: string): Promise<string> {
  const trimmed = input.trim()

  if (containsHebrew(trimmed)) {
    const translated = await translateHebrewForSlug(trimmed)
    if (translated) {
      return toSlug(translated, fallback)
    }
  }

  // Fallback: transliteration for Hebrew, direct slugify for Latin
  const transliterated = transliterateHebrew(trimmed)
  return toSlug(transliterated, fallback)
}

/**
 * Strip Payload CMS duplication suffixes from a slug.
 * Handles both formats:
 *   - " - Copy", " - Copy (2)" (Payload's actual format with spaces + capital C)
 *   - "-copy", "-copy-2" (URL-encoded variant)
 */
export function stripCopySuffix(slug: string): string {
  return slug.replace(/(\s*-\s*Copy(\s*\(\d+\))?)+$/g, '').replace(/(-copy(-\d+)?)+$/g, '')
}
