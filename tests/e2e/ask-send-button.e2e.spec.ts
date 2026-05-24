/**
 * E2E Tests for /ask page Send Button behavior
 *
 * Tests the fix for: [P2] Fix chat Send button not enabling after text input
 *
 * Steps to reproduce:
 * 1. Navigate to /ask
 * 2. Click 'New Question'
 * 3. Wait for conversation to load
 * 4. Type 'What is 2+2?' in the textbox
 *
 * Expected: Send button enables when text is present in the input
 * Actual (bug): Send button stays disabled even after text is visibly typed
 */
import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const hasOpenAIKey = !!process.env.OPENAI_API_KEY

test.describe('Ask Page Send Button', () => {
  /**
   * Helper to find the chat input on the /ask page
   */
  async function findChatInput(page: Page): Promise<Locator | null> {
    const selectors = [
      // ChatInterface input inside form with bg-muted rounded-chat-2xl
      'form:has(.bg-muted.rounded-chat-2xl) input[type="text"]',
      // Direct input with placeholder
      'input[placeholder*="שאל" i]',
      'input[placeholder*="Ask" i]',
      'input[placeholder*="question" i]',
      // Input with flex-1 class (ChatInterface specific)
      'input[type="text"].flex-1',
    ]

    for (const selector of selectors) {
      const input = page.locator(selector).first()
      if ((await input.count()) > 0) {
        const isVisible = await input.isVisible().catch(() => false)
        if (isVisible) {
          return input
        }
      }
    }

    return null
  }

  /**
   * Helper to find the send button on the /ask page
   */
  async function findSendButton(page: Page): Promise<Locator | null> {
    // Send button is a submit button with Send icon
    // ChatInterface: <button type="submit" ... aria-label={tCourses('sendMessage')}>
    const sendButton = page
      .locator('button[type="submit"]')
      .filter({ has: page.locator('svg') })
      .first()

    if (await sendButton.isVisible().catch(() => false)) {
      return sendButton
    }

    // Fallback: button with Send text or icon
    const buttonByLabel = page.getByRole('button', { name: /send|שלח/i }).first()
    if (await buttonByLabel.isVisible().catch(() => false)) {
      return buttonByLabel
    }

    return null
  }

  /**
   * Helper to wait for the chat interface to be ready on /ask page
   * This waits for the chat input to be visible and enabled
   */
  async function waitForChatInterfaceReady(page: Page, timeout = 60000): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const input = await findChatInput(page)
      if (input) {
        const isVisible = await input.isVisible().catch(() => false)
        const isDisabled = await input.isDisabled().catch(() => true)
        if (isVisible && !isDisabled) {
          return
        }
      }
      await page.waitForTimeout(500)
    }

    throw new Error('Chat interface did not become ready within timeout')
  }

  test.beforeEach(async ({ page }) => {
    // Set up localStorage user profile BEFORE navigating to /ask
    // This bypasses the RequireCourseSelection guard which checks for gradeLevel
    await page.goto('http://127.0.0.1:3000/')
    await page.evaluate(() => {
      localStorage.setItem(
        'a-guy:user-profile',
        JSON.stringify({
          gradeLevel: '8',
          mood: 'focused',
          lastVisit: new Date().toISOString(),
        }),
      )
    })
  })

  test('send button should be enabled when text is typed in input', async ({ page }) => {
    test.skip(!hasOpenAIKey, 'Skipping: OPENAI_API_KEY is not set')

    // Navigate to /ask
    await page.goto('http://127.0.0.1:3000/ask')
    await page.waitForLoadState('networkidle')

    // Wait for page to be fully loaded
    await page.waitForTimeout(2000)

    // Check if we're on the conversation grid or directly in a chat
    const newQuestionButton = page.getByRole('button', { name: /new question|שאלה חדשה/i }).first()
    const isOnGrid = await newQuestionButton.isVisible().catch(() => false)

    if (isOnGrid) {
      // Click "New Question" to create a new conversation
      await newQuestionButton.click()

      // Wait for navigation to the new conversation URL
      await page.waitForURL(/\/ask\?chat=/, { timeout: 15000 })
    }

    // Wait for chat interface to be ready
    await waitForChatInterfaceReady(page)

    // Find the chat input and type text
    const chatInput = await findChatInput(page)
    expect(chatInput).not.toBeNull()

    // Type a message using fill() - clears and types in one call
    const testMessage = 'What is 2+2?'
    await chatInput!.fill(testMessage)

    // Verify the input has the text
    const inputValue = await chatInput!.inputValue()
    expect(inputValue).toBe(testMessage)

    // Find the send button
    const sendButton = await findSendButton(page)
    expect(sendButton).not.toBeNull()

    // THE BUG: send button should be enabled when text is typed
    // But the bug says it stays disabled
    const isDisabled = await sendButton!.isDisabled()
    expect(isDisabled).toBe(false)
  })

  test('send button should be disabled when input is empty', async ({ page }) => {
    test.skip(!hasOpenAIKey, 'Skipping: OPENAI_API_KEY is not set')

    // Navigate to /ask
    await page.goto('http://127.0.0.1:3000/ask')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check if we're on the conversation grid or directly in a chat
    const newQuestionButton = page.getByRole('button', { name: /new question|שאלה חדשה/i }).first()
    const isOnGrid = await newQuestionButton.isVisible().catch(() => false)

    if (isOnGrid) {
      await newQuestionButton.click()
      await page.waitForURL(/\/ask\?chat=/, { timeout: 15000 })
    }

    // Wait for chat interface to be ready
    await waitForChatInterfaceReady(page)

    // Find the send button
    const sendButton = await findSendButton(page)
    expect(sendButton).not.toBeNull()

    // Send button should be disabled when input is empty (and no attachments)
    const isDisabled = await sendButton!.isDisabled()
    expect(isDisabled).toBe(true)
  })
})
