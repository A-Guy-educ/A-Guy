/**
 * @fileType utility
 * @domain shared
 * @pattern string-case
 * @ai-summary Converts camelCase or space-separated strings to kebab-case; null/undefined input returns undefined.
 */
export const toKebabCase = (string: string): string =>
  string
    ?.replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase()
