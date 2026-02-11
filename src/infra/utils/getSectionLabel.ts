/**
 * @fileType utility
 * @domain courses
 * @pattern i18n
 * @ai-summary Maps a 0-based index to A-J or א-י section labels.
 */

import type { Locale } from '@/i18n/config'

const EN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const
const EN_LABELS_LOWER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const
const HE_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י'] as const

export function getSectionLabel({
  index,
  locale,
  lowercase = false,
}: {
  index: number
  locale: Locale | string
  lowercase?: boolean
}): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= 10) return null

  if (locale === 'en') return lowercase ? EN_LABELS_LOWER[index] : EN_LABELS[index]
  if (locale === 'he') return HE_LABELS[index]

  return null
}
