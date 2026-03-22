// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Set storage action - sets a localStorage or sessionStorage value
 * This is a TEST UTILITY, not a DSL action
 * @fileType utility
 * @domain qa
 * @pattern storage-utility
 */
import type { Page } from '@playwright/test'

export interface SetStorageInput {
  key: string
  value: string
  type?: 'local' | 'session'
}

/**
 * Set a storage value
 */
export async function setStorage(page: Page, input: SetStorageInput): Promise<void> {
  const { key, value } = input

  await page.evaluate(
    ({ k, v }) => {
      localStorage.setItem(k, v)
    },
    { k: key, v: value },
  )
}

/**
 * Get a storage value
 */
export async function getStorage(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((k) => localStorage.getItem(k), key)
}

/**
 * Clear a storage value
 */
export async function clearStorage(page: Page, key?: string): Promise<void> {
  if (key) {
    await page.evaluate((k) => localStorage.removeItem(k), key)
  } else {
    await page.evaluate(() => localStorage.clear())
  }
}
