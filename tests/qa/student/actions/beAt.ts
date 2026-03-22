// eslint-disable @typescript-eslint/no-unused-vars
/**
 * BeAt action - asserts current URL matches a pattern
 * Renamed from: expectUrl
 * @fileType action-handler
 * @domain qa
 * @pattern assertion-actions
 * @normalized
 */
import { expect } from '@playwright/test'
import type { ActionHandler } from './types'

export const beAt: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const pattern = input?.pattern as string | undefined

  if (!pattern) {
    throw new Error('beAt action requires pattern input')
  }

  await expect(page).toHaveURL(new RegExp(pattern))
}
