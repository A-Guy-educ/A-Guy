/**
 * @fileType utility
 * @domain browser-agent
 * @pattern auth-persistence
 * @ai-summary Authenticates via Playwright and saves browser storage state for the browser agent
 */

import { chromium } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load browser agent env
dotenv.config({ path: path.resolve(import.meta.dirname, '.env') })

const email = process.env.BROWSER_AGENT_EMAIL
const password = process.env.BROWSER_AGENT_PASSWORD
const baseUrl = process.env.BROWSER_AGENT_BASE_URL || 'http://localhost:3000'

if (!email || !password) {
  console.error(
    'Missing BROWSER_AGENT_EMAIL or BROWSER_AGENT_PASSWORD in scripts/browser-agent/.env',
  )
  process.exit(1)
}

async function saveAuthState() {
  const authDir = path.resolve(import.meta.dirname, '.auth')
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  console.log(`Authenticating as ${email} at ${baseUrl}...`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to login
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })

    // Check if password login is available
    const emailInput = page.locator('input#email')
    const isPasswordLoginAvailable = await emailInput
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    if (!isPasswordLoginAvailable) {
      console.error(
        'Password login is not available (Google-only mode). Cannot save auth state automatically.',
      )
      process.exit(1)
    }

    // Fill login form
    await emailInput.fill(email as string)
    await page.locator('input#password').fill(password as string)
    await page.locator('button[type="submit"]').click()

    // Wait for successful redirect or error
    const result = await Promise.race([
      page
        .waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
        .then(() => 'success' as const),
      page
        .locator('.text-destructive')
        .waitFor({ timeout: 10000 })
        .then(() => 'error' as const),
    ]).catch(() => 'timeout' as const)

    if (result === 'error') {
      console.error('Login failed: invalid credentials')
      process.exit(1)
    }

    if (result === 'timeout') {
      console.error('Login timed out - server may not be running or credentials may be invalid')
      process.exit(1)
    }

    // Save storage state
    const storagePath = path.resolve(authDir, 'storage-state.json')
    await context.storageState({ path: storagePath })
    console.log(`Auth state saved to ${storagePath}`)

    // Verify the saved state has the auth cookie
    const cookies = await context.cookies()
    const authCookie = cookies.find((c) => c.name === 'payload-token')
    if (authCookie) {
      console.log(`Auth cookie expires: ${new Date(authCookie.expires * 1000).toISOString()}`)
    } else {
      console.warn('Warning: payload-token cookie not found in saved state')
    }
  } finally {
    await browser.close()
  }
}

saveAuthState().catch((error) => {
  console.error('Failed to save auth state:', error)
  process.exit(1)
})
