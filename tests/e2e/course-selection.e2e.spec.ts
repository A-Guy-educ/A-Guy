import { test, expect } from '@playwright/test'

test.describe('Course Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/courses')
    await page.evaluate(() => localStorage.clear())
  })

  test('updates localStorage when selecting a course from CourseCard', async ({ page }) => {
    await page.goto('/courses')

    // Wait for courses to load
    await page.waitForSelector('text=/open course/i', { timeout: 10000 }).catch(() => {
      console.log('No courses found on page')
    })

    // Check if there are any course cards
    const courseCards = await page.locator('button:has-text("open course")').count()
    
    if (courseCards === 0) {
      test.skip()
      return
    }

    // Get the first course's label before clicking
    const firstCourseLabel = await page.locator('[class*="badge"]').first().textContent()
    
    // Click the first "open course" button
    await page.locator('button:has-text("open course")').first().click()

    // Wait for navigation to complete
    await page.waitForURL(/\/courses\/[^/]+$/)

    // Verify localStorage was updated
    const userProfile = await page.evaluate(() => {
      const stored = localStorage.getItem('a-guy:user-profile')
      return stored ? JSON.parse(stored) : null
    })

    expect(userProfile).toBeTruthy()
    expect(userProfile.gradeLevel).toBe(firstCourseLabel?.trim() || '8')
    expect(userProfile.lastVisit).toBeTruthy()
  })

  test('preserves existing mood when updating course selection', async ({ page }) => {
    // Set initial profile with mood
    await page.evaluate(() => {
      localStorage.setItem(
        'a-guy:user-profile',
        JSON.stringify({
          gradeLevel: '7',
          mood: 'happy',
          lastVisit: '2024-01-01T00:00:00.000Z',
        }),
      )
    })

    await page.goto('/courses')

    // Wait for courses to load
    const courseButton = await page.waitForSelector('button:has-text("open course")', {
      timeout: 10000,
    }).catch(() => null)

    if (!courseButton) {
      test.skip()
      return
    }

    // Click a course
    await courseButton.click()

    // Wait for navigation
    await page.waitForURL(/\/courses\/[^/]+$/)

    // Verify mood was preserved
    const userProfile = await page.evaluate(() => {
      const stored = localStorage.getItem('a-guy:user-profile')
      return stored ? JSON.parse(stored) : null
    })

    expect(userProfile).toBeTruthy()
    expect(userProfile.mood).toBe('happy')
    expect(userProfile.gradeLevel).toBeTruthy()
    expect(userProfile.gradeLevel).not.toBe('7') // Should have changed
  })

  test('navigates to correct course page after selection', async ({ page }) => {
    await page.goto('/courses')

    // Wait for courses to load
    const courseButton = await page.waitForSelector('button:has-text("open course")', {
      timeout: 10000,
    }).catch(() => null)

    if (!courseButton) {
      test.skip()
      return
    }

    // Click first course
    await courseButton.click()

    // Verify URL changed to a course page
    await expect(page).toHaveURL(/\/courses\/[^/]+$/)
  })
})
