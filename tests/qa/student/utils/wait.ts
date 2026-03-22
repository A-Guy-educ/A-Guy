// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Wait utilities for explicit waits
 * This is a TEST UTILITY, not a DSL action
 * @fileType utility
 * @domain qa
 * @pattern wait-utility
 */
import type { Page, Locator } from '@playwright/test'

/**
 * Wait for an element to be visible
 */
export async function waitForElementVisible(
  page: Page,
  selector: string,
  timeout: number = 5000,
): Promise<Locator> {
  const locator = page.locator(selector).first()
  await locator.waitFor({ state: 'visible', timeout })
  return locator
}

/**
 * Wait for an element to be hidden
 */
export async function waitForElementHidden(
  page: Page,
  selector: string,
  timeout: number = 5000,
): Promise<void> {
  await page.locator(selector).first().waitFor({ state: 'hidden', timeout })
}

/**
 * Wait for an element to be attached to DOM
 */
export async function waitForElementAttached(
  page: Page,
  selector: string,
  timeout: number = 5000,
): Promise<Locator> {
  const locator = page.locator(selector).first()
  await locator.waitFor({ state: 'attached', timeout })
  return locator
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(page: Page, timeout: number = 30000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout })
}

/**
 * Wait for a specific URL pattern
 */
export async function waitForUrl(
  page: Page,
  pattern: string | RegExp,
  timeout: number = 30000,
): Promise<void> {
  await page.waitForURL(pattern, { timeout })
}

/**
 * Wait for a specific function to return true
 */
export async function waitForCondition(
  page: Page,
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 100,
): Promise<void> {
  const start = Date.now()
  while (!(await condition())) {
    if (Date.now() - start > timeout) {
      throw new Error(`Condition timed out after ${timeout}ms`)
    }
    await page.waitForTimeout(interval)
  }
}
