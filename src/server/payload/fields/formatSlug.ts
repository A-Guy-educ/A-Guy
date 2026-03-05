import slugify from 'slugify'

/**
 * Hebrew-safe slug formatting utility.
 *
 * Uses slugify with Hebrew locale to ensure Hebrew characters are preserved
 * in generated slugs. Falls back to a timestamp-based slug for empty/invalid input.
 *
 * @param input - The string to convert to a slug
 * @param fallback - Optional fallback string if the result is empty
 * @returns A URL-safe, lowercase slug string
 */
export function formatSlug(input: string, fallback?: string): string {
  const slug = slugify(input, {
    lower: true,
    strict: true,
    locale: 'he',
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
