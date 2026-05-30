import { expect, test } from '@playwright/test'

/**
 * Regression test for issue #2160: Thin white strip at the very top of the homepage.
 *
 * The root cause is the body element not having margin:0, so the user-agent
 * default body margin creates a gap at the top between the html background
 * and the body's flex container.
 *
 * @tags @homepage @regression
 */
test('body should have no top margin on homepage', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  await page.waitForLoadState('domcontentloaded')

  // Verify body has no top margin - the gap was caused by user-agent default margin
  const marginTop = await page.evaluate(() => {
    return parseFloat(getComputedStyle(document.body).marginTop)
  })
  expect(marginTop).toBe(0)
})
