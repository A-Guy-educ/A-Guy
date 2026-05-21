/**
 * Brand Messages Helper
 *
 * @fileType utility
 * @domain brands
 * @ai-summary Typed accessors for brand messages outside React/i18n context.
 */

import { getBrand } from './index'

/**
 * Returns the brand name string (e.g. "A-Guy") from the current brand bundle.
 * Use this in non-React/server contexts where i18n is not available.
 */
export function brandName(): string {
  return (getBrand().messages.en.brand as Record<string, string>)?.name ?? 'A-Guy'
}
