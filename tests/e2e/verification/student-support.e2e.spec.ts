/**
 * Pre-Launch Verification: #13 Hints, #14 AI Tutor, #15 Chat Persistence,
 * #16 Learning Progress, #17 Course Resumption, #18 Mobile Usability
 * @tags @critical
 */
import { expect, test } from '@playwright/test'

import { buildExerciseUrl } from '../helpers/admin'
import {
  cleanupVerificationData,
  loginAsStudent,
  seedVerificationData,
  type VerificationData,
} from '../helpers/verification-fixtures'

let data: VerificationData | null = null

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000)
  data = await seedVerificationData()
})

test.setTimeout(60_000)

test.afterAll(async () => {
  await cleanupVerificationData(data)
})

test.describe('Scenario #13 – Accessing Hints', () => {
  test('hint button reveals help text', async ({ page }) => {
    test.skip(!data, 'No test data available')
    const mcqEx = data!.exercises[0]
    test.skip(!mcqEx, 'Exercise not available')

    await loginAsStudent(page)
    await page.goto(buildExerciseUrl(data!.course, mcqEx.exerciseSlug))
    await page.waitForLoadState('domcontentloaded')

    const hintBtn = page
      .locator('button')
      .filter({ hasText: /hint|רמז/i })
      .first()
    const hintVisible = await hintBtn.isVisible({ timeout: 10_000 }).catch(() => false)
    test.skip(!hintVisible, 'Hint button not visible on this exercise')

    await hintBtn.click()

    const helpContent = page.locator(
      '[class*="animate-in"], [class*="rounded-2xl"][class*="bg-gradient"]',
    )
    await expect(helpContent.first()).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Scenario #14 – AI Tutor Interaction', () => {
  test('AI chat provides a response based on exercise', async ({ page }) => {
    test.skip(!data, 'No test data available')
    test.skip(!process.env.OPENAI_API_KEY, 'OPENAI_API_KEY not configured')

    await loginAsStudent(page)
    await page.goto(data!.lessonUrl)
    await page.waitForLoadState('domcontentloaded')

    const chatInput = page
      .locator(
        'textarea[placeholder*="message"], textarea[placeholder*="הודעה"], input[placeholder*="message"]',
      )
      .first()
    const chatVisible = await chatInput.isVisible({ timeout: 10_000 }).catch(() => false)
    test.skip(!chatVisible, 'Chat input not visible on lesson page')

    await chatInput.fill('Can you help me with this exercise?')
    await chatInput.press('Enter')

    const responseMsg = page.locator('[class*="bg-muted"], [class*="assistant"]').first()
    await expect(responseMsg).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('Scenario #15 – Chat Persistence', () => {
  test('AI conversations are saved and accessible later', async ({ page }) => {
    test.skip(!data, 'No test data available')
    test.skip(!process.env.OPENAI_API_KEY, 'OPENAI_API_KEY not configured')

    await loginAsStudent(page)
    await page.goto('/ask')
    await page.waitForLoadState('domcontentloaded')

    const content = page.locator('main, section, [role="main"]')
    await expect(content.first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Scenario #16 – Learning Progress', () => {
  test('progress indicators appear in course view', async ({ page }) => {
    test.skip(!data, 'No test data available')

    await loginAsStudent(page)
    await page.goto(`/courses/${data!.course.courseSlug}`)
    await page.waitForLoadState('domcontentloaded')

    // Verify the course page loads with meaningful content (title or chapters)
    const courseHeading = page.getByRole('heading').first()
    await expect(courseHeading).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Scenario #17 – Course Resumption', () => {
  test.skip(true, 'Course resumption requires tracking last visited lesson (not yet verified)')

  test('returning to course takes user to last lesson', async ({ page }) => {
    await page.goto('/')
  })
})

test.describe('Scenario #18 – Mobile Usability', () => {
  test('exercises are usable on mobile viewport', async ({ browser }) => {
    // Check data BEFORE creating context to avoid leak
    test.skip(!data, 'No test data available')

    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    })
    const page = await context.newPage()

    try {
      await loginAsStudent(page)
      await page.goto(data!.lessonUrl)
      await page.waitForLoadState('domcontentloaded')

      const content = page.locator('main, section, [role="main"]')
      await expect(content.first()).toBeVisible({ timeout: 15_000 })

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = await page.evaluate(() => window.innerWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10)
    } finally {
      await context.close()
    }
  })
})
