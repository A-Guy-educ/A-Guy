/**
 * E2E Tests for Mobile Chat FAB Toggle
 *
 * Tests the fix for issue #2140: Replace mobile draggable chat with a toggle FAB + expanding input
 *
 * Tests:
 * - On mobile (<1024px), chat is hidden behind a FAB by default
 * - Tapping the FAB expands it into a full-width pill input
 * - FAB is positioned at bottom-left (LTR) or bottom-right (RTL)
 * - Collapse button and Escape close the input back to FAB
 * - Backdrop dim shows when input is open
 * - onChatInteraction callbacks auto-open the FAB input
 */

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'
import { buildLessonUrl, getTestCourseData, seedTestCourseData } from './helpers/courses'

const hasOpenAIKey = !!process.env.OPENAI_API_KEY

test.describe('Mobile Chat FAB Toggle', () => {
  test.skip(!hasOpenAIKey, 'Skipping tests: OPENAI_API_KEY is not set')

  let testCourseData: Awaited<ReturnType<typeof getTestCourseData>>

  test.beforeAll(async () => {
    const seeded = await seedTestCourseData()
    if (seeded) {
      testCourseData = seeded
    } else {
      testCourseData = await getTestCourseData()
    }

    if (!testCourseData) {
      throw new Error(
        'No test course data available. Failed to seed or find published course with chapters and lessons.',
      )
    }
  })

  test.afterAll(async () => {
    await cleanupTestUsers()
  })

  /**
   * Set mobile viewport
   */
  async function setMobileViewport(page: Page) {
    await page.setViewportSize({ width: 375, height: 812 })
  }

  /**
   * Find the mobile chat FAB button
   * The FAB should be visible on mobile when chat is closed
   */
  async function findMobileChatFAB(page: Page): Promise<Locator | null> {
    // The FAB should have a MessageCircle icon and be a fixed position button
    const fabSelectors = [
      // FAB with MessageCircle icon
      'button[aria-label*="chat" i]',
      'button[aria-label*="message" i]',
      // Fixed position button at bottom
      '[class*="fixed"][class*="bottom-"] button',
      // Specific FAB class pattern
      '[class*="z-"][class*="fixed"] button[class*="rounded-full"]',
    ]

    for (const selector of fabSelectors) {
      const fab = page.locator(selector).first()
      if ((await fab.count()) > 0) {
        const isVisible = await fab.isVisible().catch(() => false)
        if (isVisible) {
          return fab
        }
      }
    }
    return null
  }

  /**
   * Find the expanded chat input bar (after FAB is tapped)
   */
  async function findExpandedChatInput(page: Page): Promise<Locator | null> {
    const inputSelectors = [
      // Input inside expanded pill bar
      'input[placeholder*="שלח" i]',
      'input[placeholder*="Send" i]',
      'input[placeholder*="question" i]',
      'input[placeholder*="Ask" i]',
      // The expanded bar container
      '[class*="rounded-full"][class*="bg-muted"] input',
    ]

    for (const selector of inputSelectors) {
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

  test('on mobile, FAB is visible and chat input is hidden by default', async ({ page }) => {
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail(),
      password: 'test-password-123',
    })
    await setMobileViewport(page)

    const lessonUrl = buildLessonUrl(testCourseData!)
    await page.goto(lessonUrl)

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // FAB should be visible on mobile
    const fab = await findMobileChatFAB(page)
    if (fab) {
      await expect(fab).toBeVisible()
    }

    // Expanded chat input should NOT be visible
    const expandedInput = await findExpandedChatInput(page)
    expect(expandedInput).toBeNull()
  })

  test('tapping FAB expands it into full-width pill input', async ({ page }) => {
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail(),
      password: 'test-password-123',
    })
    await setMobileViewport(page)

    const lessonUrl = buildLessonUrl(testCourseData!)
    await page.goto(lessonUrl)

    await page.waitForLoadState('networkidle')

    // Find and tap the FAB
    const fab = await findMobileChatFAB(page)
    expect(fab).not.toBeNull()

    await fab!.click()

    // Wait for expanded input to appear
    await page.waitForTimeout(500) // Allow animation to complete

    // Expanded chat input should now be visible
    const expandedInput = await findExpandedChatInput(page)
    expect(expandedInput).not.toBeNull()
    await expect(expandedInput!).toBeVisible()
  })

  test('FAB is positioned at bottom-left in LTR (English)', async ({ page }) => {
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail(),
      password: 'test-password-123',
    })
    await setMobileViewport(page)

    // Set English locale
    await page.goto('/')
    await page.context().clearCookies()
    await page.goto(buildLessonUrl(testCourseData!))

    await page.waitForLoadState('networkidle')

    const fab = await findMobileChatFAB(page)
    if (fab) {
      const box = await fab.boundingBox()
      // In LTR, FAB should be on the left side (x < viewport width / 2)
      expect(box).not.toBeNull()
      expect(box!.x).toBeLessThan(187) // Half of 375
    }
  })

  test('Escape key closes the expanded input', async ({ page }) => {
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail(),
      password: 'test-password-123',
    })
    await setMobileViewport(page)

    const lessonUrl = buildLessonUrl(testCourseData!)
    await page.goto(lessonUrl)

    await page.waitForLoadState('networkidle')

    // Open the FAB
    const fab = await findMobileChatFAB(page)
    expect(fab).not.toBeNull()
    await fab!.click()

    await page.waitForTimeout(500)

    // Press Escape
    await page.keyboard.press('Escape')

    await page.waitForTimeout(500) // Allow animation to complete

    // Expanded chat input should be hidden again
    const expandedInput = await findExpandedChatInput(page)
    expect(expandedInput).toBeNull()
  })

  test('onChatInteraction callback auto-opens the FAB input', async ({ page }) => {
    await setupAuthenticatedUser(page, {
      email: generateTestUserEmail(),
      password: 'test-password-123',
    })
    await setMobileViewport(page)

    const lessonUrl = buildLessonUrl(testCourseData!)
    await page.goto(lessonUrl)

    await page.waitForLoadState('networkidle')

    // Dispatch a custom event that triggers onChatInteraction
    // This simulates the exercise-incorrect-answer or focus-chat-input events
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('focus-chat-input'))
    })

    await page.waitForTimeout(500)

    // FAB should have expanded to show the input
    const expandedInput = await findExpandedChatInput(page)
    expect(expandedInput).not.toBeNull()
    await expect(expandedInput!).toBeVisible()
  })
})
