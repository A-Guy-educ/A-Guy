/**
 * @fileType utility
 * @domain shared
 * @pattern kebab-case-converter
 * @ai-summary Converts camelCase and space-separated strings to kebab-case; returns undefined when called on null/undefined without guarding.
 */

export const toKebabCase = (string: string): string =>
  string
    ?.replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase()
