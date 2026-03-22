// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Viewport utilities for responsive testing
 * This is a TEST UTILITY, not a DSL action
 * @fileType utility
 * @domain qa
 * @pattern viewport-utility
 */
import type { Page } from '@playwright/test'

export type ViewportPreset = 'mobile' | 'tablet' | 'desktop' | 'large'

export const VIEWPORT_PRESETS: Record<ViewportPreset, { width: number; height: number }> = {
  mobile: { width: 375, height: 667 }, // iPhone SE
  tablet: { width: 768, height: 1024 }, // iPad
  desktop: { width: 1920, height: 1080 },
  large: { width: 2560, height: 1440 },
}

/**
 * Set viewport to a preset size
 */
export async function setViewport(page: Page, preset: ViewportPreset): Promise<void> {
  const { width, height } = VIEWPORT_PRESETS[preset]
  await page.setViewportSize({ width, height })
}

/**
 * Set custom viewport size
 */
export async function setCustomViewport(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height })
}

/**
 * Get current viewport size
 */
export async function getViewport(page: Page): Promise<{ width: number; height: number }> {
  return page.viewportSize() || { width: 0, height: 0 }
}
