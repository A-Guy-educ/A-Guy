// eslint-disable @typescript-eslint/no-unused-vars
/**
 * DontSee action - asserts text is NOT visible on page
 * Renamed from: expectNotVisible
 * @fileType action-handler
 * @domain qa
 * @pattern assertion-actions
 * @normalized
 */
import { expect } from '@playwright/test'
import type { ActionHandler } from './types'

export const dontSee: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const text = input?.text as string | undefined

  if (!text) {
    throw new Error('dontSee action requires text input')
  }

  const element = page.getByText(text, { exact: false })
  await expect(element).not.toBeVisible()
}
