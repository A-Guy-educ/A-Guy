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
