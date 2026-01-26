import { expect, test } from '@playwright/test'

test.describe('Lesson Page Auth Flow', () => {
  const LESSON_URL = '/courses/test-course/chapters/ch-1/lessons/lesson-1'

  test('E1 - Login returns to same lesson URL (CRITICAL)', async ({ page }) => {
    // 1. Go to lesson page as unauthenticated user
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    // 2. Verify auth buttons visible on desktop
    await page.setViewportSize({ width: 1280, height: 720 })
    const loginBtn = page.getByTestId('exercise-header-auth').getByRole('link', { name: /log in/i })
    await expect(loginBtn).toBeVisible()

    // 3. Verify returnTo parameter
    const href = await loginBtn.getAttribute('href')
    expect(href).toContain(`returnTo=${encodeURIComponent(LESSON_URL)}`)

    // 4. Click login
    await loginBtn.click()
    await expect(page).toHaveURL(/\/login/)

    // 5. Complete login with test user
    await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')

    // 6. Verify redirect back to lesson
    await expect(page).toHaveURL(LESSON_URL, { timeout: 10000 })

    // 7. Smoke check - lesson content visible
    await expect(page.locator('header')).toBeVisible()
  })

  test('Desktop shows auth buttons, mobile shows hamburger', async ({ page }) => {
    await page.goto(LESSON_URL)

    // Desktop
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.getByTestId('exercise-header-auth')).toBeVisible()

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.getByTestId('exercise-header-auth')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible()
  })

  test('Shows UserDropdown when logged in', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')
    await page.waitForURL('/')

    // Navigate to lesson
    await page.goto(LESSON_URL)
    await page.setViewportSize({ width: 1280, height: 720 })

    // Verify UserDropdown visible, not auth buttons
    await expect(page.getByTestId('user-dropdown')).toBeVisible()
  })

  test('Signup returns to same lesson URL', async ({ page }) => {
    // 1. Go to lesson page as unauthenticated user
    await page.goto(LESSON_URL)
    await page.waitForLoadState('networkidle')

    // 2. Verify signup button visible on desktop
    await page.setViewportSize({ width: 1280, height: 720 })
    const signupBtn = page
      .getByTestId('exercise-header-auth')
      .getByRole('link', { name: /sign up/i })
    await expect(signupBtn).toBeVisible()

    // 3. Verify returnTo parameter
    const href = await signupBtn.getAttribute('href')
    expect(href).toContain(`returnTo=${encodeURIComponent(LESSON_URL)}`)

    // 4. Click signup
    await signupBtn.click()
    await expect(page).toHaveURL(/\/signup/)
  })

  test('Mobile menu auth links include returnTo', async ({ page }) => {
    await page.goto(LESSON_URL)
    await page.setViewportSize({ width: 375, height: 667 })

    // Open mobile menu
    await page.getByRole('button', { name: /open menu/i }).click()

    // Check login link has returnTo
    const loginLink = page.getByRole('link', { name: /log in/i })
    await expect(loginLink).toBeVisible()
    const loginHref = await loginLink.getAttribute('href')
    expect(loginHref).toContain(`returnTo=${encodeURIComponent(LESSON_URL)}`)

    // Check signup link has returnTo
    const signupLink = page.getByRole('link', { name: /sign up/i })
    await expect(signupLink).toBeVisible()
    const signupHref = await signupLink.getAttribute('href')
    expect(signupHref).toContain(`returnTo=${encodeURIComponent(LESSON_URL)}`)
  })
})
