// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Expect chat response action handler
 * @fileType action-handler
 * @domain qa
 * @pattern chat-actions
 */
import { expect } from '@playwright/test'
import type { ActionContext, ActionHandler } from './types'

export const expectChatResponse: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const contains = input?.contains as string | undefined
  const timeout = input?.timeout as number | undefined

  const waitTime = timeout ?? 10000 // Default 10 seconds for AI response

  // Wait for a response message to appear in chat
  // The response typically appears in a message bubble
  const responseMessage = page.locator('[class*="message"], [class*="chat"]').last()

  if (contains) {
    await responseMessage.waitFor({ state: 'visible', timeout: waitTime })
    await expect(responseMessage).toContainText(contains)
  } else {
    // Just wait for any response
    await responseMessage.waitFor({ state: 'visible', timeout: waitTime })
  }
}
