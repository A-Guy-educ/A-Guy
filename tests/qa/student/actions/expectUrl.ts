// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Expect URL action handler
 * Asserts that current URL matches a pattern
 * @fileType action-handler
 * @domain qa
 * @pattern assertion-actions
 */
import { expect } from '@playwright/test'
import type { ActionContext, ActionHandler } from './types'

export const expectUrl: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const pattern = input?.pattern as string | undefined

  if (!pattern) {
    throw new Error('expectUrl action requires pattern input')
  }

  await expect(page).toHaveURL(new RegExp(pattern))
}
