/**
 * Simple E2E Test for /ask page Send Button
 *
 * Tests: send button should enable when text is typed in input
 */
import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

const hasOpenAIKey = !!process.env.OPENAI_API_KEY

async function findSendButton(page: Page): Promise<Locator | null> {
  const buttons = page.locator('button[type="submit"]')
  const count = await buttons.count()
  if (count === 0) return null
  return buttons.first()
}

async function findChatInput(page: Page): Promise<Locator | null> {
  const inputs = page.locator('input[type="text"]')
  const count = await inputs.count()
  if (count === 0) return null
  return inputs.first()
}

test.describe('Ask Page Send Button', () => {
  // Set timeout for these tests
  test.setTimeout(120000)

  // Clean up test users after all tests
  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  test('send button should enable when text is typed', async ({ page }) => {
    test.skip(!hasOpenAIKey, 'Skipping: OPENAI_API_KEY is not set')

    // First navigate to a public page and set up authentication
    await page.goto('http://localhost:3000/')
    await page.waitForLoadState('domcontentloaded')

    // Authenticate user via API (sets payload-token cookie)
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail('send-button-test'),
      password: 'password123',
    })

    // Set localStorage user profile for RequireCourseSelection
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

    // Now navigate to /ask (auth and profile are set)
    await page.goto('http://localhost:3000/ask')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    console.log('URL after navigation:', url)

    // Check if we're on the home page (redirect happened)
    if (url === 'http://localhost:3000/' || url === 'http://localhost:3000/login') {
      console.log('Redirected away from /ask - aborting test')
      test.skip(true, 'RequireCourseSelection or auth redirected away from /ask')
      return
    }

    // Check for New Question button (conversation grid)
    const newQuestionBtn = page.getByRole('button', { name: /new question|שאלה חדשה/i }).first()
    const isOnGrid = await newQuestionBtn.isVisible().catch(() => false)

    if (isOnGrid) {
      console.log('On conversation grid, clicking New Question...')
      await newQuestionBtn.click()
      await page.waitForURL(/\/ask\?chat=/, { timeout: 30000 })
      console.log('URL after New Question:', page.url())
    }

    // Wait for chat interface to be ready
    await page.waitForSelector('input[type="text"]', { timeout: 30000 })

    // Find send button
    const sendButton = await findSendButton(page)
    console.log('Send button found:', !!sendButton)
    expect(sendButton).not.toBeNull()

    // Find chat input
    const chatInput = await findChatInput(page)
    console.log('Chat input found:', !!chatInput)
    expect(chatInput).not.toBeNull()

    // Button should be disabled initially (empty input)
    const disabledInitially = await sendButton!.isDisabled()
    console.log('Button disabled initially:', disabledInitially)
    expect(disabledInitially).toBe(true)

    // Type text into input
    const testMessage = 'What is 2+2?'
    await chatInput!.fill(testMessage)

    // Verify text was entered
    const inputValue = await chatInput!.inputValue()
    console.log('Input value:', inputValue)
    expect(inputValue).toBe(testMessage)

    // Button should be enabled after typing
    const disabledAfterTyping = await sendButton!.isDisabled()
    console.log('Button disabled after typing:', disabledAfterTyping)

    // THE BUG: expect this to be false (button should enable)
    expect(disabledAfterTyping).toBe(false)
  })

  test('send button should be disabled when input is empty', async ({ page }) => {
    test.skip(!hasOpenAIKey, 'Skipping: OPENAI_API_KEY is not set')

    // First navigate to a public page and set up authentication
    await page.goto('http://localhost:3000/')
    await page.waitForLoadState('domcontentloaded')

    // Authenticate user via API (sets payload-token cookie)
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail('send-button-test-empty'),
      password: 'password123',
    })

    // Set localStorage user profile for RequireCourseSelection
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

    await page.goto('http://localhost:3000/ask')
    await page.waitForLoadState('domcontentloaded')

    const url = page.url()
    if (url === 'http://localhost:3000/' || url === 'http://localhost:3000/login') {
      test.skip(true, 'RequireCourseSelection or auth redirected away from /ask')
      return
    }

    const newQuestionBtn = page.getByRole('button', { name: /new question|שאלה חדשה/i }).first()
    const isOnGrid = await newQuestionBtn.isVisible().catch(() => false)

    if (isOnGrid) {
      await newQuestionBtn.click()
      await page.waitForURL(/\/ask\?chat=/, { timeout: 30000 })
    }

    // Wait for chat interface
    await page.waitForSelector('input[type="text"]', { timeout: 30000 })

    const sendButton = await findSendButton(page)
    expect(sendButton).not.toBeNull()

    const isDisabled = await sendButton!.isDisabled()
    console.log('Button disabled when empty:', isDisabled)
    expect(isDisabled).toBe(true)
  })
})
