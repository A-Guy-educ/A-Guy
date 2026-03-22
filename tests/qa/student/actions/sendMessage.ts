// eslint-disable @typescript-eslint/no-unused-vars
/**
 * SendMessage action - sends a chat message
 * Renamed from: sendChatMessage
 * @fileType action-handler
 * @domain qa
 * @pattern chat-actions
 * @normalized
 */
import type { ActionHandler } from './types'
import { LABELS } from '../shared/locales'

export const sendMessage: ActionHandler = async (ctx, input) => {
  const { page, locale } = ctx
  const text = input?.text as string | undefined

  if (!text) {
    throw new Error('sendMessage action requires text input')
  }

  const labels = LABELS[locale]

  // Find the chat input by placeholder text
  const chatInput = page.getByPlaceholder(labels.typeMessage)
  await chatInput.fill(text)

  // Click send button
  const sendButton = page.getByRole('button', { name: labels.send })
  await sendButton.click()
}
