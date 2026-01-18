import { vi } from 'vitest'

export function createGeminiMock(responseText: string = 'Mock Gemini response') {
  const sendMessage = vi.fn(async () => ({
    response: {
      text: () => responseText,
    },
  }))

  const startChat = vi.fn(() => ({ sendMessage }))
  const getGenerativeModel = vi.fn(() => ({ startChat }))

  const client = {
    getGenerativeModel,
  }

  return { client, getGenerativeModel, startChat, sendMessage }
}
