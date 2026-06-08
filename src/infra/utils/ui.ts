/**
 * @fileType utility
 * @domain shared
 * @pattern classname-utility
 * @ai-summary Merges Tailwind classes with clsx + tailwind-merge; the canonical cn() for this project.
 *
 * The twMerge layer resolves Tailwind conflicts (e.g. "w-1 w-2" → "w-2"), but only for
 * classes that TwMerge recognises; custom arbitrary values like "bg-[#hex]" are passed through as-is.
 */

/**
 * Utility functions for UI components automatically added by ShadCN and used in a few of our frontend components and blocks.
 *
 * Other functions may be exported from here in the future or by installing other shadcn components.
 *
 * @fileType utility
 * @domain ui
 * @pattern clsx-merge
 * @ai-summary Merges Tailwind class names using clsx+tailwind-merge; undefined or null inputs to cn() are silently dropped rather than causing errors.
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
