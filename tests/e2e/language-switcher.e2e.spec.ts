import { test, expect, devices } from '@playwright/test'

test.describe('Language Switcher', () => {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'

  test.describe('Desktop', () => {
    test('should render custom Radix UI select on desktop', async ({ page }) => {
      await page.goto(baseURL)

      // Wait for language switcher to be visible
      const languageSwitcher = page.locator('[role="combobox"]').first()
      await expect(languageSwitcher).toBeVisible()

      // Should have aria attributes from Radix UI
      await expect(languageSwitcher).toHaveAttribute('aria-haspopup', 'listbox')
    })

    test('should switch language on desktop', async ({ page }) => {
      await page.goto(baseURL)

      // Get initial HTML lang attribute
      const initialLang = await page.locator('html').getAttribute('lang')
      expect(initialLang).toBeTruthy()

      // Click the language switcher
      const languageSwitcher = page.locator('[role="combobox"]').first()
      await languageSwitcher.click()

      // Wait for dropdown to appear
      await page.waitForSelector('[role="listbox"]')

      // Select the other language (if English, select Hebrew; if Hebrew, select English)
      const targetLang = initialLang === 'en' ? 'he' : 'en'
      const option = page.locator(`[role="option"][value="${targetLang}"]`)
      await option.click()

      // Wait for language to change
      await page.waitForTimeout(500)

      // Verify HTML lang attribute changed
      const newLang = await page.locator('html').getAttribute('lang')
      expect(newLang).toBe(targetLang)
    })

    test('should update text direction when switching to RTL language', async ({ page }) => {
      await page.goto(baseURL)

      // Switch to Hebrew (RTL)
      const languageSwitcher = page.locator('[role="combobox"]').first()
      await languageSwitcher.click()

      await page.waitForSelector('[role="listbox"]')
      const hebrewOption = page.locator('[role="option"][value="he"]')
      await hebrewOption.click()

      // Wait for direction to update
      await page.waitForTimeout(500)

      // Verify HTML dir attribute is RTL
      const dir = await page.locator('html').getAttribute('dir')
      expect(dir).toBe('rtl')
    })
  })

  test.describe('Mobile', () => {
    test.use({ ...devices['iPhone 13'] })

    test('should render native select on mobile', async ({ page }) => {
      await page.goto(baseURL)

      // Wait for page to load
      await page.waitForLoadState('networkidle')

      // On mobile, should render native select element
      const nativeSelect = page.locator('select[aria-label*="Language"], select[aria-label*="language"], select[aria-label*="anguage"]').first()
      await expect(nativeSelect).toBeVisible({ timeout: 10000 })

      // Should NOT have Radix UI combobox
      const radixCombobox = page.locator('[role="combobox"]')
      await expect(radixCombobox).toHaveCount(0)
    })

    test('should switch language on mobile tap', async ({ page }) => {
      await page.goto(baseURL)

      // Wait for page to load
      await page.waitForLoadState('networkidle')

      // Get initial HTML lang attribute
      const initialLang = await page.locator('html').getAttribute('lang')
      expect(initialLang).toBeTruthy()

      // Find the native select
      const nativeSelect = page.locator('select[aria-label*="Language"], select[aria-label*="language"], select[aria-label*="anguage"]').first()
      await expect(nativeSelect).toBeVisible({ timeout: 10000 })

      // Select the other language
      const targetLang = initialLang === 'en' ? 'he' : 'en'
      await nativeSelect.selectOption(targetLang)

      // Wait for language to change
      await page.waitForTimeout(500)

      // Verify HTML lang attribute changed
      const newLang = await page.locator('html').getAttribute('lang')
      expect(newLang).toBe(targetLang)
    })

    test('should handle RTL language switch on mobile', async ({ page }) => {
      await page.goto(baseURL)

      // Wait for page to load
      await page.waitForLoadState('networkidle')

      // Find the native select
      const nativeSelect = page.locator('select[aria-label*="Language"], select[aria-label*="language"], select[aria-label*="anguage"]').first()
      await expect(nativeSelect).toBeVisible({ timeout: 10000 })

      // Switch to Hebrew (RTL)
      await nativeSelect.selectOption('he')

      // Wait for direction to update
      await page.waitForTimeout(500)

      // Verify HTML dir attribute is RTL
      const dir = await page.locator('html').getAttribute('dir')
      expect(dir).toBe('rtl')
    })

    test('should persist language after page reload on mobile', async ({ page }) => {
      await page.goto(baseURL)

      // Wait for page to load
      await page.waitForLoadState('networkidle')

      // Find the native select
      const nativeSelect = page.locator('select[aria-label*="Language"], select[aria-label*="language"], select[aria-label*="anguage"]').first()
      await expect(nativeSelect).toBeVisible({ timeout: 10000 })

      // Switch to Hebrew
      await nativeSelect.selectOption('he')
      await page.waitForTimeout(500)

      // Reload the page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Verify language persisted
      const lang = await page.locator('html').getAttribute('lang')
      expect(lang).toBe('he')

      const dir = await page.locator('html').getAttribute('dir')
      expect(dir).toBe('rtl')
    })
  })

  test.describe('Mobile (Android)', () => {
    test.use({ ...devices['Pixel 5'] })

    test('should work on Android devices', async ({ page }) => {
      await page.goto(baseURL)

      // Wait for page to load
      await page.waitForLoadState('networkidle')

      // Should render native select
      const nativeSelect = page.locator('select[aria-label*="Language"], select[aria-label*="language"], select[aria-label*="anguage"]').first()
      await expect(nativeSelect).toBeVisible({ timeout: 10000 })

      // Test language switch
      const initialLang = await page.locator('html').getAttribute('lang')
      const targetLang = initialLang === 'en' ? 'he' : 'en'
      
      await nativeSelect.selectOption(targetLang)
      await page.waitForTimeout(500)

      const newLang = await page.locator('html').getAttribute('lang')
      expect(newLang).toBe(targetLang)
    })
  })
})
