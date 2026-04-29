const { chromium } = require('playwright')
const path = require('path')

// Change to project directory
process.chdir('/home/runner/work/A-Guy/A-Guy')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Login via API using Payload
    const { getPayload } = require('payload')
    const config = require('./payload.config.ts')

    // Use dynamic import for TypeScript config
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    const loginResult = await payload.login({
      collection: 'users',
      data: {
        email: 'aguy.aharon.yair@gmail.com',
        password: 'As121212',
      },
    })

    if (loginResult && 'token' in loginResult && loginResult.token) {
      console.log('Login successful, token obtained')

      // Set auth cookie
      await context.addCookies([
        {
          name: 'payload-token',
          value: loginResult.token,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ])

      // Navigate to instructor dashboard
      await page.goto('http://localhost:3002/instructor')
      await page.waitForLoadState('networkidle')

      const url = page.url()
      console.log('Instructor page URL:', url)

      // Check for heading
      const heading = await page
        .locator('h1')
        .first()
        .textContent({ timeout: 10000 })
        .catch(() => 'Not found')
      console.log('Heading:', heading)

      // Take screenshot
      await page.screenshot({ path: '/tmp/instructor-admin.png', fullPage: true })
      console.log('Screenshot saved to /tmp/instructor-admin.png')

      // Check if course cards are visible
      const courseCards = await page.locator('a[href*="/instructor/course/"]').count()
      console.log('Course cards visible:', courseCards)

      // Check for admin-specific elements
      const adminHeading = await page.locator('text=/Course Oversight|פיקוח קורסים/i').count()
      console.log('Admin heading visible:', adminHeading > 0)

      // Check for instructor badges (only shown for admin)
      const badges = await page.locator('text=/Primary|ראשי|TA|עוזר/i').count()
      console.log('Instructor badges visible:', badges)
    } else {
      console.log('Login failed - no token returned')
    }
  } catch (error) {
    console.log('Error:', error.message)
  }

  await browser.close()
}

main()
