// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Send chat message action handler
 * @fileType action-handler
 * @domain qa
 * @pattern chat-actions
 */
import type { ActionContext, ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const sendChatMessage: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const text = input?.text as string | undefined

  if (!text) {
    throw new Error('sendChatMessage action requires text input')
  }

  const labels = LABELS[locale]

  // Find the chat input by placeholder text
  const chatInput = page.getByPlaceholder(labels.typeMessage)
  await chatInput.fill(text)

  // Click send button
  const sendButton = page.getByRole('button', { name: labels.send })
  await sendButton.click()
}
