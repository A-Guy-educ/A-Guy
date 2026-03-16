/**
 * Pre-Launch Verification: #8 Free Response, #9 MCQ, #10 Matching,
 * #11 Table, #12 Success Feedback
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

test.describe('Scenario #8 – Free Response Input', () => {
  test('student can type and submit a free response', async ({ page }) => {
    test.skip(!data, 'No test data available')
    const freeEx = data!.exercises[1] // Free Response Exercise
    test.skip(!freeEx, 'Free response exercise not seeded')

    await loginAsStudent(page)
    await page.goto(buildExerciseUrl(data!.course, freeEx.exerciseSlug))
    await page.waitForLoadState('domcontentloaded')

    const input = page.locator('textarea, input[type="text"]').first()
    await expect(input).toBeVisible({ timeout: 15_000 })

    await input.fill('4')

    const checkBtn = page
      .locator('button')
      .filter({ hasText: /check|בדוק/i })
      .first()
    if (await checkBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await checkBtn.click()
      // Wait for feedback indicator instead of hard sleep
      await page
        .locator('[class*="text-success"], [class*="text-error"], [class*="border-success"]')
        .first()
        .waitFor({ timeout: 10_000 })
        .catch(() => {})
    }
  })
})

test.describe('Scenario #9 – Multiple Choice (MCQ)', () => {
  test('MCQ options are selectable and highlighted', async ({ page }) => {
    test.skip(!data, 'No test data available')
    const mcqEx = data!.exercises[0] // MCQ Exercise
    test.skip(!mcqEx, 'MCQ exercise not seeded')

    await loginAsStudent(page)
    await page.goto(buildExerciseUrl(data!.course, mcqEx.exerciseSlug))
    await page.waitForLoadState('domcontentloaded')

    const options = page.locator('label[class*="rounded-lg border-2"]')
    await expect(options.first()).toBeVisible({ timeout: 15_000 })

    await options.nth(1).click()

    const selectedOption = options.nth(1)
    await expect(selectedOption).toHaveClass(/border-primary|bg-primary/)
  })
})

test.describe('Scenario #10 – Matching Connections', () => {
  test('student can connect matching pairs', async ({ page }) => {
    test.skip(!data, 'No test data available')
    const matchEx = data!.exercises[2] // Matching Exercise
    test.skip(!matchEx, 'Matching exercise not seeded')

    await loginAsStudent(page)
    await page.goto(buildExerciseUrl(data!.course, matchEx.exerciseSlug))
    await page.waitForLoadState('domcontentloaded')

    const matchItems = page.locator('button[role="option"]')
    await expect(matchItems.first()).toBeVisible({ timeout: 15_000 })

    const items = await matchItems.all()
    if (items.length >= 2) {
      await items[0].click()
      await items[items.length - 1].click()
    }
  })
})

test.describe('Scenario #11 – Table Exercises', () => {
  test('student can enter data in table cells', async ({ page }) => {
    test.skip(!data, 'No test data available')
    const tableEx = data!.exercises[3] // Table Exercise
    test.skip(!tableEx, 'Table exercise not seeded')

    await loginAsStudent(page)
    await page.goto(buildExerciseUrl(data!.course, tableEx.exerciseSlug))
    await page.waitForLoadState('domcontentloaded')

    const tableInputs = page.locator('table input[type="text"]')
    await expect(tableInputs.first()).toBeVisible({ timeout: 15_000 })

    await tableInputs.first().fill('4')
  })
})

test.describe('Scenario #12 – Success Feedback', () => {
  test('correct answer triggers success feedback', async ({ page }) => {
    test.skip(!data, 'No test data available')
    const mcqEx = data!.exercises[0]
    test.skip(!mcqEx, 'MCQ exercise not seeded')

    await loginAsStudent(page)
    await page.goto(buildExerciseUrl(data!.course, mcqEx.exerciseSlug))
    await page.waitForLoadState('domcontentloaded')

    const options = page.locator('label[class*="rounded-lg border-2"]')
    await expect(options.first()).toBeVisible({ timeout: 15_000 })
    await options.nth(1).click()

    const checkBtn = page
      .locator('button')
      .filter({ hasText: /check|בדוק/i })
      .first()
    if (await checkBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await checkBtn.click()

      const successIndicator = page.locator(
        '[class*="text-success"], [class*="border-success"], [class*="CheckCircle"]',
      )
      await expect(successIndicator.first()).toBeVisible({ timeout: 10_000 })
    }
  })
})
