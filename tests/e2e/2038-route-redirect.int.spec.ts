/**
 * Issue #2038: [P1] Practice, Test, and Study pages silently redirect to /start
 *
 * When an authenticated user navigates directly to /practice, /test, or /study
 * without having set a gradeLevel in localStorage (i.e., hasn't completed
 * persona selection), they should be redirected to /onboarding/persona to
 * complete onboarding.
 *
 * The bug was that they were redirected to / (homepage), which then redirects
 * to /start because no home page exists in the CMS — silently landing on
 * /start instead of the intended page.
 */
import { expect, test } from '@playwright/test'

import { cleanupTestUsers, generateTestUserEmail, setupAuthenticatedUser } from './helpers/auth'

test.describe('Issue #2038 - Route redirects', () => {
  test.afterEach(async () => {
    await cleanupTestUsers()
  })

  test('authenticated user without gradeLevel should be redirected to /onboarding/persona from /practice', async ({
    page,
  }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('issue-2038'),
        password: 'TestPass123!',
      },
      'student',
    )

    // Clear localStorage to simulate user who hasn't completed persona selection
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('a-guy:user-profile'))

    // Navigate to /practice
    await page.goto('/practice')
    await page.waitForURL(/\/(onboarding\/persona|practice)/, { timeout: 8000 })

    // Should land on /onboarding/persona, NOT /start
    const url = page.url()
    expect(url).not.toMatch(/\/start/)
    expect(url).toMatch(/\/onboarding\/persona/)
  })

  test('authenticated user without gradeLevel should be redirected to /onboarding/persona from /study', async ({
    page,
  }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('issue-2038'),
        password: 'TestPass123!',
      },
      'student',
    )

    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('a-guy:user-profile'))

    await page.goto('/study')
    await page.waitForURL(/\/(onboarding\/persona|study)/, { timeout: 8000 })

    const url = page.url()
    expect(url).not.toMatch(/\/start/)
    expect(url).toMatch(/\/onboarding\/persona/)
  })

  test('authenticated user without gradeLevel should be redirected to /onboarding/persona from /test', async ({
    page,
  }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('issue-2038'),
        password: 'TestPass123!',
      },
      'student',
    )

    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('a-guy:user-profile'))

    await page.goto('/test')
    await page.waitForURL(/\/(onboarding\/persona|test)/, { timeout: 8000 })

    const url = page.url()
    expect(url).not.toMatch(/\/start/)
    expect(url).toMatch(/\/onboarding\/persona/)
  })

  test('authenticated user without gradeLevel should be redirected to /onboarding/persona from /ask', async ({
    page,
  }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('issue-2038'),
        password: 'TestPass123!',
      },
      'student',
    )

    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('a-guy:user-profile'))

    await page.goto('/ask')
    await page.waitForURL(/\/(onboarding\/persona|ask)/, { timeout: 8000 })

    const url = page.url()
    expect(url).not.toMatch(/\/start/)
    expect(url).toMatch(/\/onboarding\/persona/)
  })
})
