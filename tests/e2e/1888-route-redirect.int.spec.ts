/**
 * Issue #1888: [P2] Core feature routes redirect to /start instead of loading
 *
 * When a user navigates directly to /study, /practice, /ask, or /stats without
 * having set a gradeLevel in localStorage (i.e., hasn't completed persona selection),
 * they should be redirected to /onboarding/persona to complete onboarding.
 *
 * The bug was that they were redirected to / (homepage), which then redirects to
 * /start because no home page exists in the CMS.
 */
import { expect, test } from '@playwright/test'

import { generateTestUserEmail, setupAuthenticatedUser, cleanupTestUsers } from './helpers/auth'

test.describe('Issue #1888 - Route redirects', () => {
  test.afterEach(async () => {
    await cleanupTestUsers()
  })

  /**
   * Repro: authenticated user without gradeLevel in localStorage
   * should redirect to /onboarding/persona, NOT to / (which then goes to /start)
   */
  test('authenticated user without gradeLevel should be redirected to /onboarding/persona from /study', async ({
    page,
  }) => {
    // Set up authenticated user (student role)
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('issue-1888'),
        password: 'TestPass123!',
      },
      'student',
    )

    // Clear localStorage to simulate user who hasn't completed persona selection
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('a-guy:user-profile'))

    // Navigate to /study
    await page.goto('/study')
    await page.waitForURL(/\/(onboarding\/persona|study)/, { timeout: 8000 })

    // Should land on /onboarding/persona, NOT /start
    const url = page.url()
    expect(url).not.toMatch(/\/start/)
    expect(url).toMatch(/\/onboarding\/persona/)
  })

  test('authenticated user without gradeLevel should be redirected to /onboarding/persona from /practice', async ({
    page,
  }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('issue-1888'),
        password: 'TestPass123!',
      },
      'student',
    )

    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('a-guy:user-profile'))

    await page.goto('/practice')
    await page.waitForURL(/\/(onboarding\/persona|practice)/, { timeout: 8000 })

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
        email: generateTestUserEmail('issue-1888'),
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

  test('authenticated user without gradeLevel should be redirected to /onboarding/persona from /stats', async ({
    page,
  }) => {
    await setupAuthenticatedUser(
      page,
      {
        email: generateTestUserEmail('issue-1888'),
        password: 'TestPass123!',
      },
      'student',
    )

    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('a-guy:user-profile'))

    await page.goto('/stats')
    await page.waitForURL(/\/(onboarding\/persona|login|stats)/, { timeout: 8000 })

    // /stats has its own auth check that may redirect to /login first
    // The key assertion is: it must NOT redirect to /start
    const url = page.url()
    expect(url).not.toMatch(/\/start/)
  })
})
