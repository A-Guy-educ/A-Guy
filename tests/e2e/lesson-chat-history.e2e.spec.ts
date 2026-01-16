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
import { expect, test } from '@playwright/test'
import { setupAuthenticatedUser, generateTestUserEmail, cleanupTestUsers } from './helpers/auth'
import { getTestCourseData, buildLessonUrl, seedTestCourseData } from './helpers/courses'

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
   * Helper to find chat input - works with both ChatInterface and NotebookChat
   */
  async function findChatInput(page: any) {
    // Try different selectors for chat input
    const selectors = [
      'input[type="text"]:not([name="name"]):not([name="email"]):not([name="password"])',
      'textarea[name="message"]',
      'input[name="message"]',
      'input[placeholder*="message" i]',
      'input[placeholder*="ask" i]',
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
  async function waitForChatMessage(page: any, timeout = 30000) {
    // Wait for any message div (user or assistant)
    await page.waitForSelector('.bg-primary, .bg-muted', { timeout })
  }

  /**
   * Helper to get chat messages
   */
  async function getChatMessages(page: any) {
    const userMessages = await page.locator('.bg-primary').all()
    const assistantMessages = await page.locator('.bg-muted').all()
    return { userMessages, assistantMessages }
  }

  /**
   * Helper to wait for chat input to be enabled
   */
  async function waitForChatInputEnabled(chatInput: any, timeout = 30000) {
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
    // Authenticate User A
    const userA = await setupAuthenticatedUser(page, {
      email: generateTestUserEmail('chat-history-user-a'),
      password: 'password123',
    })

    // Navigate to lesson page
    const lessonUrl = buildLessonUrl(testCourseData!)
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

    // Verify chat history loads after refresh
    const messagesAfterRefresh = await getChatMessages(page)
    expect(messagesAfterRefresh.userMessages.length).toBeGreaterThan(0)
    expect(messagesAfterRefresh.assistantMessages.length).toBeGreaterThan(0)

    // Verify the original message is still present
    const pageContent = await page.textContent('body')
    expect(pageContent).toContain(testMessage)
  })

  test('should isolate chat history between different users', async ({ page }) => {
    // Authenticate User A
    const userA = await setupAuthenticatedUser(page, {
      email: generateTestUserEmail('chat-history-isolation-a'),
      password: 'password123',
    })

    // Navigate to lesson page
    const lessonUrl = buildLessonUrl(testCourseData!)
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
    const userB = await setupAuthenticatedUser(page, {
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
    const pageContent = await page.textContent('body')

    // User B should have empty chat (no previous conversation)
    // OR if there are messages, they should NOT contain User A's message
    if (messagesB.userMessages.length > 0) {
      // If messages exist, verify they don't contain User A's message
      expect(pageContent).not.toContain(userAMessage)
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
    // Authenticate User A
    const userA = await setupAuthenticatedUser(page, {
      email: generateTestUserEmail('chat-history-api-a'),
      password: 'password123',
    })

    // Navigate to lesson page
    const lessonUrl = buildLessonUrl(testCourseData!)
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
    const apiCalls: any[] = []
    page.on('response', (response: any) => {
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
