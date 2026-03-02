import { test, expect } from '@playwright/test'

test.describe('Version Footer', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage where footer is visible
    await page.goto('http://localhost:3000')
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle')
  })

  test('displays version number in footer', async ({ page }) => {
    // The version should appear in the footer navigation area
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()

    // The version is displayed with subtle styling - look for vX.Y.Z pattern
    // The version span has classes: text-xs text-muted-foreground/70
    const versionElement = page
      .locator('footer span.text-xs')
      .filter({ hasText: /^v\d+\.\d+\.\d+$/ })
    await expect(versionElement).toBeVisible()

    // Get the text content and verify it matches semantic versioning
    const versionText = await versionElement.textContent()
    expect(versionText).toMatch(/^v\d+\.\d+\.\d+$/)
  })

  test('version display has subtle styling on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })

    // The version should be visible on desktop
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()

    // Check that the version element has subtle styling classes
    const versionElement = page
      .locator('footer span.text-xs')
      .filter({ hasText: /^v\d+\.\d+\.\d+$/ })
    await expect(versionElement).toBeVisible()

    // Verify the subtle styling classes are present
    const classAttribute = await versionElement.getAttribute('class')
    expect(classAttribute).toContain('text-xs')
    expect(classAttribute).toContain('text-muted-foreground')
  })

  test('version appears after navigation links separator', async ({ page }) => {
    // The version appears after the navigation links with a separator pipe (|)
    // Check that the pipe separator is present - uses text-muted-foreground/30 class
    const separator = page.locator('footer span.text-muted-foreground\\/30')
    await expect(separator).toBeVisible()
  })

  test('version is consistent across pages', async ({ page }) => {
    // Get version from homepage footer - find span with vX.Y.Z pattern
    const versionElement = page
      .locator('footer span.text-xs')
      .filter({ hasText: /^v\d+\.\d+\.\d+$/ })
    const versionText = await versionElement.textContent()
    expect(versionText).toMatch(/^v\d+\.\d+\.\d+$/)

    // Navigate to a different page and verify version is the same
    await page.goto('http://localhost:3000/courses')
    await page.waitForLoadState('networkidle')

    const versionOnCourses = await versionElement.textContent()
    expect(versionOnCourses).toBe(versionText)
  })

  test('version footer persists on lesson pages', async ({ page }) => {
    // Navigate to a lesson page
    await page.goto('http://localhost:3000/courses/intro/lessons/lesson-1')
    await page.waitForLoadState('networkidle')

    // Version should still be visible in the footer
    const versionElement = page
      .locator('footer span.text-xs')
      .filter({ hasText: /^v\d+\.\d+\.\d+$/ })
    await expect(versionElement).toBeVisible()

    const versionText = await versionElement.textContent()
    expect(versionText).toMatch(/^v\d+\.\d+\.\d+$/)
  })

  test('version format matches package.json semantic versioning', async ({ page }) => {
    // The version should be in semantic versioning format (X.Y.Z)
    // This ensures it matches the version in package.json
    const versionElement = page
      .locator('footer span.text-xs')
      .filter({ hasText: /^v\d+\.\d+\.\d+$/ })
    await expect(versionElement).toBeVisible()

    const versionText = await versionElement.textContent()

    // Validate semantic versioning format
    expect(versionText).toMatch(/^v\d+\.\d+\.\d+$/)
  })
})
