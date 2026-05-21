/**
 * Brand Bundle Unit Tests
 *
 * @fileType unit-test
 * @domain brands
 * @ai-summary Tests for the getBrand() resolver.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getBrand, getBrandSlug } from '@/brands'

describe('getBrand', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns the aguy bundle when NEXT_PUBLIC_BRAND is unset', () => {
    delete process.env.NEXT_PUBLIC_BRAND
    const brand = getBrand()
    expect(brand.config.slug).toBe('aguy')
    expect(brand.config.name).toBe('A-Guy')
  })

  it('getBrand().config.slug equals aguy when env is unset', () => {
    delete process.env.NEXT_PUBLIC_BRAND
    expect(getBrand().config.slug).toBe('aguy')
  })

  it('throws in non-production when brand slug is unknown', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development' })
    process.env.NEXT_PUBLIC_BRAND = 'does-not-exist'
    expect(() => getBrand()).toThrow('Unknown NEXT_PUBLIC_BRAND="does-not-exist"')
  })

  it('throws in test environment when brand slug is unknown', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test' })
    process.env.NEXT_PUBLIC_BRAND = 'unknown-brand'
    expect(() => getBrand()).toThrow('Unknown NEXT_PUBLIC_BRAND="unknown-brand"')
  })

  it('falls back to default brand in production when slug is unknown', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production' })
    process.env.NEXT_PUBLIC_BRAND = 'invalid-brand'
    const brand = getBrand()
    expect(brand.config.slug).toBe('aguy')
  })

  it('returns aguy brand when NEXT_PUBLIC_BRAND is explicitly set to aguy', () => {
    process.env.NEXT_PUBLIC_BRAND = 'aguy'
    const brand = getBrand()
    expect(brand.config.slug).toBe('aguy')
    expect(brand.config.host).toBe('https://www.aguy.co.il')
  })

  it('getBrandSlug returns the resolved slug', () => {
    delete process.env.NEXT_PUBLIC_BRAND
    expect(getBrandSlug()).toBe('aguy')
  })

  it('getBrandSlug returns aguy when env is set to aguy', () => {
    process.env.NEXT_PUBLIC_BRAND = 'aguy'
    expect(getBrandSlug()).toBe('aguy')
  })

  it('getBrand().Logo is a React component', () => {
    delete process.env.NEXT_PUBLIC_BRAND
    const brand = getBrand()
    expect(brand.Logo).toBeDefined()
    expect(typeof brand.Logo).toBe('function')
  })
})
