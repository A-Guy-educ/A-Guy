// eslint-disable @typescript-eslint/no-unused-vars
/**
 * WaitForMessage action - waits for AI chat response
 * Renamed from: expectChatResponse
 * @fileType action-handler
 * @domain qa
 * @pattern chat-actions
 * @normalized
 */
import { expect } from '@playwright/test'
import type { ActionHandler } from './types'
import { SELECTORS } from '../shared/selectors'

export const waitForMessage: ActionHandler = async (ctx, input) => {
  const { page } = ctx
  const contains = input?.contains as string | undefined
  const timeout = input?.timeout as number | undefined

  const waitTime = timeout ?? 10000 // Default 10 seconds for AI response

  // Wait for a response message to appear in chat
  const responseMessage = page.locator(SELECTORS.chat.messageBubble).last()

  if (contains) {
    await responseMessage.waitFor({ state: 'visible', timeout: waitTime })
    await expect(responseMessage).toContainText(contains)
  } else {
    await responseMessage.waitFor({ state: 'visible', timeout: waitTime })
  }
}
