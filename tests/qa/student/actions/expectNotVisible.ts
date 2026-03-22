// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Expect not visible action handler
 * Asserts that text is NOT visible on the page
 * @fileType action-handler
 * @domain qa
 * @pattern assertion-actions
 */
import { expect } from '@playwright/test'
import type { ActionContext, ActionHandler } from './types'

export const expectNotVisible: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const text = input?.text as string | undefined

  if (!text) {
    throw new Error('expectNotVisible action requires text input')
  }

  const element = page.getByText(text, { exact: false })
  await expect(element).not.toBeVisible()
}
