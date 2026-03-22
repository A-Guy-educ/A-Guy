// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Expect visible action handler
 * Asserts that text is visible on the page
 * @fileType action-handler
 * @domain qa
 * @pattern assertion-actions
 */
import { expect } from '@playwright/test'
import type { ActionContext, ActionHandler } from './types'

export const expectVisible: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const text = input?.text as string | undefined
  const timeout = input?.timeout as number | undefined

  if (!text) {
    throw new Error('expectVisible action requires text input')
  }

  const element = page.getByText(text, { exact: false }).first()
  await expect(element).toBeVisible({ timeout: timeout ?? 5000 })
}
