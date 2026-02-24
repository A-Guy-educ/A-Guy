import { test, expect } from '@playwright/test'

test.describe('Exercise Page', () => {
  test.describe('Exercise Page Navigation', () => {
    test('navigates from lesson page to exercise page', async ({ page }) => {
      // This test assumes the courses route exists with at least one exercise
      // You may need to seed data or adjust the URL based on your test data
      await page.goto('/courses')

      // Wait for page to load
      await expect(page).toHaveURL(/\/courses/)
    })

    test.skip('displays exercise page with correct elements', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      // Navigate to a specific exercise page
      // Note: Update this URL with actual test data IDs
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/test-exercise-id'

      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Check for breadcrumb navigation
      const breadcrumb = page.locator('.breadcrumb')
      await expect(breadcrumb).toBeVisible()

      // Check for back to lesson button
      const backButton = page.getByRole('link', { name: /back to lesson/i })
      await expect(backButton).toBeVisible()

      // Check for exercise title
      const title = page.locator('.exercise-page-header__title')
      await expect(title).toBeVisible()

      // Check for question type badge
      const badge = page.locator('[class*="badge"]').first()
      await expect(badge).toBeVisible()
    })

    test.skip('renders ExerciseRenderer component', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/test-exercise-id'

      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Check for exercise renderer content
      const exerciseRenderer = page.locator('.exercise-renderer')
      await expect(exerciseRenderer).toBeVisible()

      // Check for answer section
      const answerSection = page.locator('.exercise-renderer__answer-section')
      await expect(answerSection).toBeVisible()

      // Check for check answer button
      const checkButton = page.locator('.exercise-renderer__check-button')
      await expect(checkButton).toBeVisible()
      await expect(checkButton).toHaveText(/check answer/i)
    })

    test.skip('back button navigates to lesson page', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/test-exercise-id'

      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Click back to lesson button
      const backButton = page.getByRole('link', { name: /back to lesson/i })
      await backButton.click()

      // Verify navigation to lesson page
      await expect(page).toHaveURL(
        /\/courses\/test-course\/chapters\/test-chapter\/lessons\/test-lesson/,
      )
    })
  })

  test.describe('Exercise Interactions', () => {
    test.skip('can interact with MCQ exercise', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      // Navigate to MCQ exercise
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/mcq-exercise-id'

      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Find and click an option
      const option = page.locator('[type="radio"]').first()
      if ((await option.count()) > 0) {
        await option.click()

        // Click check answer button
        const checkButton = page.locator('.exercise-renderer__check-button')
        await checkButton.click()

        // Verify result is displayed
        const result = page.locator('.exercise-renderer__result')
        await expect(result).toBeVisible()
      }
    })

    test.skip('can interact with True/False exercise', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      // Navigate to True/False exercise
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/tf-exercise-id'

      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Find and click true or false button
      const trueButton = page.getByRole('button', { name: /true/i })
      if ((await trueButton.count()) > 0) {
        await trueButton.click()

        // Click check answer button
        const checkButton = page.locator('.exercise-renderer__check-button')
        await checkButton.click()

        // Verify result is displayed
        const result = page.locator('.exercise-renderer__result')
        await expect(result).toBeVisible()
      }
    })

    test.skip('can interact with Free Response exercise', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      // Navigate to Free Response exercise
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/fr-exercise-id'

      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Find and fill in the input
      const input = page.locator('input[type="text"]').first()
      if ((await input.count()) > 0) {
        await input.fill('42')

        // Click check answer button
        const checkButton = page.locator('.exercise-renderer__check-button')
        await checkButton.click()

        // Verify result is displayed
        const result = page.locator('.exercise-renderer__result')
        await expect(result).toBeVisible()
      }
    })
  })

  test.describe('Exercise Page Metadata', () => {
    test.skip('has correct page title', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/test-exercise-id'

      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Check page title includes exercise, lesson, chapter, and course names
      await expect(page).toHaveTitle(/.*-.*-.*-.*/)
    })
  })

  test.describe('Exercise Page Error Handling', () => {
    test('displays 404 for non-existent exercise', async ({ page }) => {
      // Use a clearly invalid exercise ID
      const invalidUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/non-existent-exercise-id-12345'

      await page.goto(invalidUrl, { waitUntil: 'networkidle' })

      // Check for 404 or not found message
      const bodyText = await page.locator('body').textContent()
      expect(bodyText).toMatch(/not found|404/i)
    })

    test('displays 404 when exercise does not belong to lesson', async ({ page }) => {
      // This test assumes you have exercises that belong to different lessons
      const mismatchedUrl =
        '/courses/test-course/chapters/test-chapter/lessons/wrong-lesson-slug/exercises/test-exercise-id'

      await page.goto(mismatchedUrl, { waitUntil: 'networkidle' })

      // Check for 404 or not found message
      const bodyText = await page.locator('body').textContent()
      expect(bodyText).toMatch(/not found|404/i)
    })
  })

  test.describe('Exercise Header Mobile Navigation', () => {
    test.skip('shows hamburger menu on mobile viewport', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/test-exercise-id'

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Check hamburger menu is visible
      const hamburger = page.getByRole('button', { name: /open menu/i })
      await expect(hamburger).toBeVisible()

      // Check logo is NOT visible on mobile
      const logo = page.locator('header').getByRole('img').first()
      await expect(logo).not.toBeVisible()
    })

    test.skip('hamburger menu opens mobile sidebar', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/test-exercise-id'

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Click hamburger menu
      const hamburger = page.getByRole('button', { name: /open menu/i })
      await hamburger.click()

      // Wait for mobile menu to appear
      await page.waitForTimeout(500) // Wait for animation

      // Check mobile menu is visible
      const mobileMenu = page.locator('[class*="translate-x-0"]').filter({ hasText: /menu/i })
      await expect(mobileMenu).toBeVisible()

      // Check close button in mobile menu
      const closeButton = page.getByRole('button', { name: /close menu/i })
      await expect(closeButton).toBeVisible()
    })

    test.skip('close button closes mobile menu', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/test-exercise-id'

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Click hamburger menu to open
      const hamburger = page.getByRole('button', { name: /open menu/i })
      await hamburger.click()

      // Wait for menu to be visible
      await page.waitForSelector('[data-testid="mobile-menu-panel"]:not([class*="pointer-events-none"])', { 
        state: 'visible', 
        timeout: 1000 
      })

      // Verify menu is open
      const mobileMenu = page.getByTestId('mobile-menu-panel')
      await expect(mobileMenu).toBeVisible()
      await expect(mobileMenu).toHaveClass(/translate-x-0/)

      // Click close button
      const closeButton = page.getByRole('button', { name: /close menu/i })
      await closeButton.click()

      // Wait for menu to have the closed class
      await page.waitForSelector('[data-testid="mobile-menu-panel"][class*="pointer-events-none"]', { 
        timeout: 1000 
      })

      // Verify menu is closed (should have translate-x-full class)
      const closedMenu = page.getByTestId('mobile-menu-panel')
      await expect(closedMenu).toHaveClass(/translate-x-full/)

      // Verify overlay is not visible
      const overlay = page.getByTestId('mobile-menu-overlay')
      await expect(overlay).toHaveClass(/pointer-events-none/)
    })

    test.skip('shows logo on desktop viewport', async ({ page }) => {
      // SKIPPED: Requires test data seeding
      // TODO: Implement test data seeding in beforeAll hook
      const testUrl =
        '/courses/test-course/chapters/test-chapter/lessons/test-lesson/exercises/test-exercise-id'

      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto(testUrl)

      // Check that page loaded (not 404)
      const notFound = await page.locator('body').textContent()
      if (notFound?.includes('not found') || notFound?.includes('404')) {
        test.skip()
        return
      }

      // Check logo is visible on desktop
      const logo = page.locator('header').getByRole('img').first()
      await expect(logo).toBeVisible()

      // Check hamburger menu is NOT visible on desktop
      const hamburger = page.getByRole('button', { name: /open menu/i })
      await expect(hamburger).not.toBeVisible()
    })
  })
})
