/**
 * Brand Bundle Resolver
 *
 * @fileType utility
 * @domain brands
 * @ai-summary Resolves the active brand bundle based on NEXT_PUBLIC_BRAND env var.
 */

import type { Brand, BrandSlug } from './types'
import { aguyBrand } from './aguy'

const brands = {
  aguy: aguyBrand,
} as const satisfies Record<BrandSlug, Brand>

const DEFAULT_BRAND: BrandSlug = 'aguy'

function resolveBrandSlug(): BrandSlug {
  const raw = process.env.NEXT_PUBLIC_BRAND ?? DEFAULT_BRAND
  if (raw in brands) return raw as BrandSlug
  // Fail loudly in dev/build, fall back in prod to avoid hard crash
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(`Unknown NEXT_PUBLIC_BRAND="${raw}". Known: ${Object.keys(brands).join(', ')}`)
  }
  return DEFAULT_BRAND
}

export function getBrand(): Brand {
  return brands[resolveBrandSlug()]
}

export function getBrandSlug(): BrandSlug {
  return resolveBrandSlug()
}

export type { Brand, BrandSlug, BrandConfig } from './types'
