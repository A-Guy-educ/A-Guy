/**
 * E2E Tests for Lesson Page Chat History Loading
 *
 * Tests the fix for: Chat history on lesson pages loads conversations from the wrong user
 *
 * Tests:
 * - Login as User A, send message, refresh, verify history loads
 * - Login as User B on same lesson, verify User A's history NOT visible
 * - Test logout clears conversation context properly
 */
import type { Locator, Page, Response } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'
import { buildLessonUrl, getTestCourseData, seedTestCourseData } from './helpers/courses'

test.describe('Lesson Chat History Loading', () => {
  let testCourseData: Awaited<ReturnType<typeof getTestCourseData>>

  test.beforeAll(async () => {
    // Seed test course data if it doesn't exist
    const seeded = await seedTestCourseData()
    if (seeded) {
      testCourseData = seeded
    } else {
      // If seeding failed, try to get existing data
      testCourseData = await getTestCourseData()
    }

    if (!testCourseData) {
      throw new Error(
        'No test course data available. Failed to seed or find published course with chapters and lessons.',
      )
    }
  })

  // Clean up all test users after all tests complete
  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  /**
   * Selector for user chat messages (excludes buttons and other bg-primary elements)
   * User messages have: ml-auto bg-primary and contain text content
   */
  const USER_MESSAGE_SELECTOR = '.bg-primary.ml-auto'

  /**
   * Helper to find chat input - works with both ChatInterface and NotebookChat
   */
  async function findChatInput(page: Page): Promise<Locator> {
    // Try different selectors for chat input (in order of specificity)
    const selectors = [
      // ChatInterface input inside form with bg-muted rounded-[30px]
      'form:has(.bg-muted.rounded-\\[30px\\]) input[type="text"]',
      // More specific: input inside the chat form
      'form input[type="text"].flex-1',
      // Input with placeholder matching chat translation
      'input[placeholder*="שאל" i]',
      'input[placeholder*="Ask" i]',
      'input[placeholder*="question" i]',
      // Fallback: any text input that's not a form field
      'input[type="text"]:not([name="name"]):not([name="email"]):not([name="password"])',
      // Textarea fallback
      'textarea',
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

    throw new Error('Could not find chat input field')
  }

  /**
   * Helper to wait for chat message to appear
   */
  async function waitForChatMessage(page: Page, timeout = 30000) {
    // Wait for any message div (user or assistant)
    // User messages have ml-auto class to distinguish from send button
    // ChatInterface uses bg-card for assistant messages, NotebookChat uses bg-muted
    await page.waitForSelector(`${USER_MESSAGE_SELECTOR}, .bg-muted, .bg-card`, { timeout })
  }

  /**
   * Helper to get chat messages
   */
  async function getChatMessages(page: Page): Promise<{
    userMessages: Locator[]
    assistantMessages: Locator[]
  }> {
    // Use more specific selector for user messages (ml-auto distinguishes from send button)
    const userMessages = await page.locator(USER_MESSAGE_SELECTOR).all()
    // ChatInterface uses bg-card for assistant messages, NotebookChat uses bg-muted
    const assistantMessages = await page.locator('.bg-muted, .bg-card').all()
    return { userMessages, assistantMessages }
  }

  /**
   * Helper to get chat message text content
   */
  async function getChatMessageTexts(page: Page, selector: string) {
    return page.locator(selector).allTextContents()
  }

  /**
   * Helper to wait for chat history loading to finish
   * Waits for loading indicator to disappear AND ensures messages are loaded
   */
  async function waitForHistoryLoaded(page: Page, timeout = 30000) {
    const loadingIndicator = page.locator('text=Loading conversation...')
    const userMessages = page.locator(USER_MESSAGE_SELECTOR)

    // First, wait for loading indicator to disappear (if it was visible)
    // This ensures the API call has completed
    try {
      const isVisible = await loadingIndicator.isVisible().catch(() => false)
      if (isVisible) {
        await loadingIndicator.waitFor({ state: 'hidden', timeout })
      }
    } catch {
      // Loading indicator might not have been visible, that's okay
    }

    // Then wait for messages to appear (with polling to handle async rendering)
    // Use expect.poll to wait for messages to actually be present
    await expect
      .poll(
        async () => {
          const count = await userMessages.count()
          return count
        },
        {
          timeout,
          intervals: [200, 500, 1000], // Check more frequently at first
        },
      )
      .toBeGreaterThan(0)

    // Small additional wait for React state to fully settle
    await page.waitForTimeout(500)
  }

  /**
   * Helper to wait for chat input to be enabled
   */
  async function waitForChatInputEnabled(chatInput: Locator, timeout = 30000) {
    await chatInput.waitFor({ state: 'visible', timeout })
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      const isDisabled = await chatInput.isDisabled().catch(() => true)
      if (!isDisabled) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    const stillDisabled = await chatInput.isDisabled().catch(() => true)
    if (stillDisabled) {
      throw new Error('Chat input remained disabled after timeout')
    }
  }

  test('should load chat history after refresh for User A', async ({ page }) => {
    // Skip if no test data
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    // Check if lesson page exists before navigating
    const lessonUrl = buildLessonUrl(testCourseData)

    // Navigate to lesson page
    await page.goto(lessonUrl)
    await page.waitForLoadState('networkidle')

    // Check if page has content (not 404)
    const heading = await page
      .locator('h1')
      .first()
      .textContent()
      .catch(() => null)
    if (heading === '404' || heading === 'Page not found') {
      test.skip(true, 'Lesson page not found - test data may not be seeded')
      return
    }

    // Authenticate User A
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail('chat-history-user-a'),
      password: 'password123',
    })

    // Reload page after login
    await page.goto(lessonUrl)
    await page.waitForLoadState('networkidle')

    // Wait for page to fully load
    await page.waitForTimeout(2000)
    const chatInput = await findChatInput(page)
    await waitForChatInputEnabled(chatInput)

    // Send a message
    const testMessage = `Hello from User A - ${Date.now()}`
    await chatInput.fill(testMessage)
    await chatInput.press('Enter')

    // Wait for response
    await waitForChatMessage(page, 30000)

    // Verify message appears
    const messagesAfterSend = await getChatMessages(page)
    expect(messagesAfterSend.userMessages.length).toBeGreaterThan(0)
    expect(messagesAfterSend.assistantMessages.length).toBeGreaterThan(0)

    // Refresh the page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await waitForHistoryLoaded(page, 30000)

    // Verify chat history loads after refresh
    const messagesAfterRefresh = await getChatMessages(page)
    expect(messagesAfterRefresh.userMessages.length).toBeGreaterThan(0)
    expect(messagesAfterRefresh.assistantMessages.length).toBeGreaterThan(0)

    // Verify the original message is still present
    await expect
      .poll(
        async () => {
          const userMessageTexts = await getChatMessageTexts(page, USER_MESSAGE_SELECTOR)
          return userMessageTexts.join(' ')
        },
        { timeout: 30000 },
      )
      .toContain(testMessage)
  })

  test('should isolate chat history between different users', async ({ page }) => {
    // Skip if no test data
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    // Check if lesson page exists
    const lessonUrl = buildLessonUrl(testCourseData)
    await page.goto(lessonUrl)
    await page.waitForLoadState('networkidle')

    // Check if page has content (not 404)
    const heading = await page
      .locator('h1')
      .first()
      .textContent()
      .catch(() => null)
    if (heading === '404' || heading === 'Page not found') {
      test.skip(true, 'Lesson page not found - test data may not be seeded')
      return
    }

    // Authenticate User A
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail('chat-history-isolation-a'),
      password: 'password123',
    })

    // Reload page after login
    await page.goto(lessonUrl)
    await page.waitForLoadState('networkidle')

    // Wait for page to fully load
    await page.waitForTimeout(2000)
    const chatInput = await findChatInput(page)
    await waitForChatInputEnabled(chatInput)

    // User A sends a message
    const userAMessage = `Private message from User A - ${Date.now()}`
    await chatInput.fill(userAMessage)
    await chatInput.press('Enter')

    // Wait for response
    await waitForChatMessage(page, 30000)

    // Verify User A's message appears
    const messagesA = await getChatMessages(page)
    expect(messagesA.userMessages.length).toBeGreaterThan(0)

    // Logout User A
    await page.goto('/logout')
    await page.waitForLoadState('networkidle')

    // Authenticate User B
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail('chat-history-isolation-b'),
      password: 'password123',
    })

    // Navigate to same lesson page
    await page.goto(lessonUrl)
    await page.waitForLoadState('networkidle')

    // Wait for page to fully load
    await page.waitForTimeout(2000)
    const chatInputB = await findChatInput(page)
    await waitForChatInputEnabled(chatInputB)

    // Verify User B does NOT see User A's messages
    const messagesB = await getChatMessages(page)

    // User B should have empty chat (no previous conversation)
    // OR if there are messages, they should NOT contain User A's message
    if (messagesB.userMessages.length > 0) {
      // If messages exist, verify they don't contain User A's message
      const userMessageTexts = await getChatMessageTexts(page, USER_MESSAGE_SELECTOR)
      expect(userMessageTexts.join(' ')).not.toContain(userAMessage)
    } else {
      // Empty chat is also valid - User B has no conversation yet
      expect(messagesB.userMessages.length).toBe(0)
    }

    // User B sends their own message
    const userBMessage = `Private message from User B - ${Date.now()}`
    await chatInputB.fill(userBMessage)
    await chatInputB.press('Enter')

    // Wait for response
    await waitForChatMessage(page, 30000)

    // Verify User B's message appears
    const messagesBAfterSend = await getChatMessages(page)
    expect(messagesBAfterSend.userMessages.length).toBeGreaterThan(0)

    // Verify User B still doesn't see User A's message
    const pageContentAfter = await page.textContent('body')
    expect(pageContentAfter).not.toContain(userAMessage)
    expect(pageContentAfter).toContain(userBMessage)
  })

  test('should verify API endpoint returns correct user conversation', async ({ page }) => {
    // Skip if no test data
    if (!testCourseData) {
      test.skip(true, 'No test course data available')
      return
    }

    // Check if lesson page exists
    const lessonUrl = buildLessonUrl(testCourseData)
    await page.goto(lessonUrl)
    await page.waitForLoadState('networkidle')

    // Check if page has content (not 404)
    const heading = await page
      .locator('h1')
      .first()
      .textContent()
      .catch(() => null)
    if (heading === '404' || heading === 'Page not found') {
      test.skip(true, 'Lesson page not found - test data may not be seeded')
      return
    }

    // Authenticate User A
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail('chat-history-api-a'),
      password: 'password123',
    })

    // Reload page after login
    await page.goto(lessonUrl)
    await page.waitForLoadState('networkidle')

    // Wait for page to fully load
    await page.waitForTimeout(2000)
    const chatInput = await findChatInput(page)
    await waitForChatInputEnabled(chatInput)

    // Send a message
    const testMessage = `API test message - ${Date.now()}`
    await chatInput.fill(testMessage)
    await chatInput.press('Enter')

    // Wait for response
    await waitForChatMessage(page, 30000)

    // Intercept API call to verify it uses the new endpoint
    const apiCalls: Array<{ url: string; status: number }> = []
    page.on('response', (response: Response) => {
      if (response.url().includes('/api/agent/conversation')) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
        })
      }
    })

    // Refresh the page to trigger conversation loading
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Verify the new endpoint was called
    const conversationApiCalls = apiCalls.filter((call) =>
      call.url.includes('/api/agent/conversation'),
    )
    expect(conversationApiCalls.length).toBeGreaterThan(0)

    // Verify all calls were successful
    for (const call of conversationApiCalls) {
      expect(call.status).toBe(200)
    }

    // Verify chat history loaded
    const messagesAfterRefresh = await getChatMessages(page)
    expect(messagesAfterRefresh.userMessages.length).toBeGreaterThan(0)
  })
})
