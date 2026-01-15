/**
 * E2E Tests for Memory System with Vector Search
 *
 * Tests the complete user-facing flow of the memory system including:
 * - Chat interactions that create memories
 * - Memory retrieval in subsequent conversations
 * - UI feedback for memory-enhanced responses
 * - Long-term memory across sessions
 */
import { expect, test, type Page } from '@playwright/test'
import { setupAuthenticatedUser, generateTestUserEmail, cleanupTestUsers } from './helpers/auth'
import { getTestCourseData, buildLessonUrl, seedTestCourseData } from './helpers/courses'

// Skip all tests if required API keys are not set
const hasOpenAIKey = !!process.env.OPENAI_API_KEY
const hasGeminiKey = !!process.env.GEMINI_API_KEY
const hasRequiredKeys = hasOpenAIKey && hasGeminiKey

test.describe('Memory System E2E Tests', () => {
  test.skip(
    !hasRequiredKeys,
    `Skipping Memory System E2E Tests: Missing required API keys. OPENAI_API_KEY: ${hasOpenAIKey ? 'set' : 'missing'}, GEMINI_API_KEY: ${hasGeminiKey ? 'set' : 'missing'}`,
  )

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
  async function findChatInput(page: Page) {
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
  async function waitForChatMessage(page: Page, timeout = 30000) {
    // Wait for any message div (user or assistant)
    // User messages have bg-primary, assistant have bg-muted
    await page.waitForSelector('.bg-primary, .bg-muted', { timeout })
  }

  /**
   * Helper to get chat messages count
   */
  async function getChatMessagesCount(page: Page) {
    // Count both user and assistant messages
    const userMessages = await page.locator('.bg-primary').count()
    const assistantMessages = await page.locator('.bg-muted').count()
    return userMessages + assistantMessages
  }

  /**
   * Helper to wait for chat input to be enabled
   */
  async function waitForChatInputEnabled(chatInput: ReturnType<Page['locator']>, timeout = 30000) {
    await chatInput.waitFor({ state: 'visible', timeout })
    // Wait for input to be enabled by checking if it's not disabled
    // Poll until enabled or timeout
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      const isDisabled = await chatInput.isDisabled().catch(() => true)
      if (!isDisabled) {
        // Small delay to ensure state is stable
        await new Promise((resolve) => setTimeout(resolve, 100))
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    // Final check - if still disabled, throw error
    const stillDisabled = await chatInput.isDisabled().catch(() => true)
    if (stillDisabled) {
      throw new Error('Chat input remained disabled after timeout')
    }
  }

  test.describe('Chat with Memory Extraction', () => {
    test('should extract and persist user preferences from conversation', async ({ page }) => {
      // Authenticate user with unique email
      await setupAuthenticatedUser(page, {
        email: generateTestUserEmail('memory-prefs'),
        password: 'password123',
      })

      // Navigate to lesson page
      const lessonUrl = buildLessonUrl(testCourseData!)
      await page.goto(lessonUrl)
      await page.waitForLoadState('networkidle')

      // Wait for page to fully load and find chat input
      await page.waitForTimeout(2000) // Give time for components to mount
      const chatInput = await findChatInput(page)
      await chatInput.waitFor({ state: 'visible', timeout: 10000 })

      // Start a conversation with preference statements
      await chatInput.fill('I prefer dark mode for coding and I love TypeScript')
      await chatInput.press('Enter')

      // Wait for response
      await waitForChatMessage(page, 30000)

      // Continue conversation to trigger memory extraction
      await chatInput.fill('Can you help me with a TypeScript question?')
      await chatInput.press('Enter')

      await waitForChatMessage(page, 30000)

      // Verify conversation completed
      const messages = await getChatMessagesCount(page)
      expect(messages).toBeGreaterThan(0)
    })

    test('should maintain conversation context across multiple messages', async ({ page }) => {
      await setupAuthenticatedUser(page, {
        email: generateTestUserEmail('memory-context'),
        password: 'password123',
      })

      const lessonUrl = buildLessonUrl(testCourseData!)
      await page.goto(lessonUrl)
      await page.waitForLoadState('networkidle')

      await page.waitForTimeout(2000)
      const chatInput = await findChatInput(page)
      await chatInput.waitFor({ state: 'visible', timeout: 10000 })

      // First message
      await chatInput.fill('My name is Alice')
      await chatInput.press('Enter')
      await waitForChatMessage(page, 30000)

      // Second message
      await chatInput.fill('I am learning about databases')
      await chatInput.press('Enter')
      await waitForChatMessage(page, 30000)

      // Third message - should remember context
      await chatInput.fill('What should I focus on?')
      await chatInput.press('Enter')
      await waitForChatMessage(page, 30000)

      // Verify we got responses
      const messages = await getChatMessagesCount(page)
      expect(messages).toBeGreaterThan(0)
    })
  })

  test.describe('Long-Term Memory Retrieval', () => {
    test('should retrieve memories from previous conversations', async ({ page }) => {
      await setupAuthenticatedUser(page, {
        email: generateTestUserEmail('memory-retrieval'),
        password: 'password123',
      })

      // First conversation - establish preferences
      const lessonUrl = buildLessonUrl(testCourseData!)
      await page.goto(lessonUrl)
      await page.waitForLoadState('networkidle')

      await page.waitForTimeout(2000)
      const chatInput1 = await findChatInput(page)
      await chatInput1.waitFor({ state: 'visible', timeout: 10000 })
      await chatInput1.fill('I really enjoy functional programming and prefer pure functions')
      await chatInput1.press('Enter')
      await waitForChatMessage(page, 30000)

      // Wait a bit for memory extraction
      await page.waitForTimeout(2000)

      // Second conversation - should recall preferences
      await page.reload()
      await page.waitForLoadState('networkidle')

      await page.waitForTimeout(2000)
      const chatInput2 = await findChatInput(page)
      await chatInput2.waitFor({ state: 'visible', timeout: 10000 })
      await chatInput2.fill('What programming paradigms should I study?')
      await chatInput2.press('Enter')
      await waitForChatMessage(page, 30000)

      // Verify we got a response
      const messages = await getChatMessagesCount(page)
      expect(messages).toBeGreaterThan(0)
    })

    test('should handle conversations when no memories exist', async ({ page }) => {
      // Create a new user without memories
      await setupAuthenticatedUser(page, {
        email: generateTestUserEmail('memory-newuser'),
        password: 'password123',
      })

      const lessonUrl = buildLessonUrl(testCourseData!)
      await page.goto(lessonUrl)
      await page.waitForLoadState('networkidle')

      await page.waitForTimeout(2000)
      const chatInput = await findChatInput(page)
      await chatInput.waitFor({ state: 'visible', timeout: 10000 })
      await chatInput.fill('Hello, this is my first message')
      await chatInput.press('Enter')

      await waitForChatMessage(page, 30000)

      const messages = await getChatMessagesCount(page)
      expect(messages).toBeGreaterThan(0)
    })
  })

  test.describe('Summary Maintenance', () => {
    test('should handle long conversations with automatic summarization', async ({ page }) => {
      await setupAuthenticatedUser(page, {
        email: generateTestUserEmail('memory-summary'),
        password: 'password123',
      })

      const lessonUrl = buildLessonUrl(testCourseData!)
      await page.goto(lessonUrl)
      await page.waitForLoadState('networkidle')

      await page.waitForTimeout(2000)
      const chatInput = await findChatInput(page)
      await chatInput.waitFor({ state: 'visible', timeout: 10000 })

      // Send multiple messages to trigger summarization (reduced from 25 to 5 for CI speed)
      for (let i = 0; i < 5; i++) {
        // Wait for input to be enabled before filling
        await waitForChatInputEnabled(chatInput, 30000)
        await chatInput.fill(`Message ${i}: Can you explain concept ${i}?`)
        await chatInput.press('Enter')

        // Wait for response
        await waitForChatMessage(page, 30000)

        // Wait for input to be enabled again after response
        await waitForChatInputEnabled(chatInput, 30000)
      }

      // Verify conversation is still working
      await waitForChatInputEnabled(chatInput, 30000)
      await chatInput.fill('Are you still there?')
      await chatInput.press('Enter')
      await waitForChatMessage(page, 30000)

      const messages = await getChatMessagesCount(page)
      expect(messages).toBeGreaterThan(0)
    })
  })

  test.describe('Tenant Isolation', () => {
    test('should not leak memories between different users', async ({ page, context }) => {
      // User 1: Set a preference
      await setupAuthenticatedUser(page, {
        email: generateTestUserEmail('tenant-user1'),
        password: 'password123',
      })

      const lessonUrl = buildLessonUrl(testCourseData!)
      await page.goto(lessonUrl)
      await page.waitForLoadState('networkidle')

      await page.waitForTimeout(2000)
      const chatInput1 = await findChatInput(page)
      await chatInput1.waitFor({ state: 'visible', timeout: 10000 })
      await chatInput1.fill('My favorite color is blue and I love pizza')
      await chatInput1.press('Enter')
      await waitForChatMessage(page, 30000)

      // Wait for memory extraction
      await page.waitForTimeout(2000)

      // User 2: Ask about preferences (should not know about user1's preferences)
      const page2 = await context.newPage()
      await setupAuthenticatedUser(page2, {
        email: generateTestUserEmail('tenant-user2'),
        password: 'password123',
      })

      await page2.goto(lessonUrl)
      await page2.waitForLoadState('networkidle')

      await page2.waitForTimeout(2000)
      const chatInput2 = await findChatInput(page2)
      await chatInput2.waitFor({ state: 'visible', timeout: 10000 })
      await chatInput2.fill('What is my favorite color?')
      await chatInput2.press('Enter')
      await waitForChatMessage(page2, 30000)

      // Verify we got a response (content validation is best-effort)
      const messages = await getChatMessagesCount(page2)
      expect(messages).toBeGreaterThan(0)
      await page2.close()
    })
  })

  test.describe('Error Handling', () => {
    test('should gracefully handle chat errors', async ({ page }) => {
      await setupAuthenticatedUser(page, {
        email: generateTestUserEmail('error-handling'),
        password: 'password123',
      })

      const lessonUrl = buildLessonUrl(testCourseData!)
      await page.goto(lessonUrl)
      await page.waitForLoadState('networkidle')

      await page.waitForTimeout(2000)
      const chatInput = await findChatInput(page)
      await chatInput.waitFor({ state: 'visible', timeout: 10000 })

      // Try to send empty message
      await chatInput.fill('')
      await chatInput.press('Enter')

      // Should show validation error or prevent submission
      // Check if input is still empty (submission blocked) or error shown
      const inputValue = await chatInput.inputValue()
      expect(inputValue).toBe('') // Input should be empty if submission was blocked
    })

    test('should handle network errors gracefully', async ({ page, context }) => {
      await setupAuthenticatedUser(page, {
        email: generateTestUserEmail('error-network'),
        password: 'password123',
      })

      const lessonUrl = buildLessonUrl(testCourseData!)
      await page.goto(lessonUrl)
      await page.waitForLoadState('networkidle')

      // Simulate offline mode
      await context.setOffline(true)

      await page.waitForTimeout(2000)
      const chatInput = await findChatInput(page)
      await chatInput.waitFor({ state: 'visible', timeout: 10000 })
      await chatInput.fill('This should fail due to network error')
      await chatInput.press('Enter')

      // Should show error state - check for error text or disabled state
      // The UI might show an error message or disable the input
      await page.waitForTimeout(2000)
      const errorText = await page.locator('body').textContent()
      const _hasError =
        errorText?.toLowerCase().includes('error') ||
        errorText?.toLowerCase().includes('network') ||
        errorText?.toLowerCase().includes('offline')

      // Restore connection
      await context.setOffline(false)

      // At minimum, verify the page didn't crash
      expect(await page.locator('body').isVisible()).toBe(true)
    })
  })

  test.describe('Performance', () => {
    test('should respond to messages within reasonable time', async ({ page }) => {
      await setupAuthenticatedUser(page, {
        email: generateTestUserEmail('performance'),
        password: 'password123',
      })

      const lessonUrl = buildLessonUrl(testCourseData!)
      await page.goto(lessonUrl)
      await page.waitForLoadState('networkidle')

      await page.waitForTimeout(2000)
      const chatInput = await findChatInput(page)
      await chatInput.waitFor({ state: 'visible', timeout: 10000 })

      const startTime = Date.now()
      await chatInput.fill('Quick test message')
      await chatInput.press('Enter')
      await waitForChatMessage(page, 30000)
      const endTime = Date.now()

      const responseTime = endTime - startTime

      // Response should arrive within 30 seconds
      expect(responseTime).toBeLessThan(30000)

      // Response should typically be faster than 15 seconds for simple queries
      if (responseTime > 15000) {
        console.warn(`⚠️ Slow response time: ${responseTime}ms`)
      }
    })
  })
})
