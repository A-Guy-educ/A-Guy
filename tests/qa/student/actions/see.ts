// eslint-disable @typescript-eslint/no-unused-vars
/**
 * See action - asserts text is visible on page
 * Renamed from: expectVisible
 * @fileType action-handler
 * @domain qa
 * @pattern assertion-actions
 * @normalized
 */
import { expect } from '@playwright/test'
import type { ActionHandler } from './types'

export const see: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const text = input?.text as string | undefined
  const timeout = input?.timeout as number | undefined

  if (!text) {
    throw new Error('see action requires text input')
  }

  const element = page.getByText(text, { exact: false }).first()
  await expect(element).toBeVisible({ timeout: timeout ?? 5000 })
}
