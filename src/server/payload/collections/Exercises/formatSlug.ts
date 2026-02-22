import slugify from 'slugify'

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
