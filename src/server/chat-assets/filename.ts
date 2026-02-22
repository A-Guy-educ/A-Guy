/**
 * Filename Sanitization Utility
 * Sanitizes filenames for safe storage in Vercel Blob
 */

export function sanitizeFilename(original: string): string {
  if (!original || typeof original !== 'string') {
    return 'unnamed'
  }

  // Extract extension
  const lastDotIndex = original.lastIndexOf('.')
  let name = original
  let extension = ''

  if (lastDotIndex > 0 && lastDotIndex < original.length - 1) {
    name = original.slice(0, lastDotIndex)
    extension = original.slice(lastDotIndex)
  }

  // Convert to ASCII-safe lowercase
  name = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s-]/g, '') // Remove non-ASCII characters except spaces/hyphens/underscores
    .replace(/[\s_]+/g, '-') // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '') // Trim leading/trailing hyphens
    .toLowerCase()

  // If name became empty or just whitespace
  if (!name || name.length === 0) {
    name = 'file'
  }

  // Cap name length (leave room for random suffix if needed)
  const maxNameLength = 80
  if (name.length > maxNameLength) {
    name = name.slice(0, maxNameLength)
  }

  // Normalize extension
  extension = extension.toLowerCase()

  // Combine and cap total length
  const maxTotalLength = 120
  const result = name + extension
  if (result.length > maxTotalLength) {
    const availableForName = maxTotalLength - extension.length
    return name.slice(0, Math.max(10, availableForName)) + extension
  }

  return result
}
