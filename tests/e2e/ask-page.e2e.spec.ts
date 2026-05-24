/**
 * E2E Test for Ask Page - Bug #2037
 *
 * Issue: Ask page renders with blank content — no chat interface
 * Route: /ask
 *
 * Expected: Chat interface with message input field and conversation area
 * Actual: Nav bar and footer render, but the entire main content area is blank white
 */
import { test, expect } from '@playwright/test'

test.describe('Ask Page - #2037', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('displays ask page content (not blank)', async ({ page }) => {
    // Set up user profile with gradeLevel so RequireCourseSelection passes
    await page.evaluate(() => {
      localStorage.setItem(
        'a-guy:user-profile',
        JSON.stringify({
          gradeLevel: '8',
          mood: 'happy',
          lastVisit: new Date().toISOString(),
        }),
      )
    })

    await page.goto('/ask')

    // Wait for the page to load and render content
    // The main content area should NOT be blank
    // It should show either:
    // 1. Loading skeleton (while fetching conversations)
    // 2. Conversation grid (with "New Question" card)
    // 3. Some UI element from AskConversationGrid

    // Wait for content to appear - look for elements that should be present
    // The page should NOT have an empty main-content div
    const mainContent = page.locator('#main-content')

    // First wait for navigation to complete
    await page.waitForURL(/\/ask/, { timeout: 10000 })

    // The main content should have some visible content
    // Check that the main content div is not empty/blank
    await expect(mainContent).not.toBeEmpty()

    // Also check that we see actual page content, not just white space
    // The conversation grid or loading indicator should be present
    const body = page.locator('body')

    // Should see either a heading, button, or conversation cards
    const hasContent = await page.evaluate(() => {
      const main = document.getElementById('main-content')
      if (!main) return false
      // Check if there's any visible text content
      const text = main.textContent?.trim()
      return text && text.length > 0
    })

    expect(hasContent).toBe(true)
  })

  test('displays conversation grid or loading state', async ({ page }) => {
    // Set up user profile with gradeLevel
    await page.evaluate(() => {
      localStorage.setItem(
        'a-guy:user-profile',
        JSON.stringify({
          gradeLevel: '8',
          mood: 'happy',
          lastVisit: new Date().toISOString(),
        }),
      )
    })

    await page.goto('/ask')
    await page.waitForURL(/\/ask/, { timeout: 10000 })

    // Should see either loading state or conversation grid
    // Check for the "New Question" button which is always present in the grid
    // OR check for loading spinner
    const hasNewQuestionButton = await page
      .getByRole('button', { name: /new question/i })
      .isVisible()
      .catch(() => false)

    const hasLoadingSpinner = await page
      .locator('.animate-spin')
      .isVisible()
      .catch(() => false)

    // At least one should be true (either content loaded or still loading)
    expect(hasNewQuestionButton || hasLoadingSpinner).toBe(true)
  })
})
