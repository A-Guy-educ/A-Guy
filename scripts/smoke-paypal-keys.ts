/**
 * PayPal Sandbox Keys Smoke Test
 *
 * @fileType script
 * @domain payment
 * @ai-summary Verifies PayPal sandbox credentials by creating and voiding a test order.
 *
 * Usage:
 *   pnpm tsx scripts/smoke-paypal-keys.ts
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Missing env vars, invalid credentials, or API error
 */

import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// Load .env.local first so env vars are available
dotenvConfig({ path: path.join(projectRoot, '.env.local') })

// Production credential patterns — refuse to run if these look like real keys
// These are based on actual PayPal production credential formats
const PRODUCTION_PATTERNS = [
  { pattern: /^AV[A-Za-z0-9]{41}$/, name: 'PayPal production client ID (AV prefix)' },
  { pattern: /^EH[A-Za-z0-9]{41}$/, name: 'PayPal production client ID (EH prefix)' },
  { pattern: /^([A-Za-z0-9]{80,})$/, name: 'unusually long credential (possibly production)' },
]

const SANDBOX_DOC_URL =
  'https://github.com/A-Guy-educ/A-Guy/blob/dev/docs/payment/paypal-sandbox-setup.md'
const SANDBOX_API_BASE = 'https://api-m.sandbox.paypal.com'

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface OrderResponse {
  id: string
  status: string
  links: Array<{ href: string; rel: string }>
}

function readEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function detectProductionCredential(name: string, value: string): void {
  for (const { pattern, name: patternName } of PRODUCTION_PATTERNS) {
    if (pattern.test(value)) {
      console.error(`\n[ERROR] ${name} looks like a PRODUCTION credential (${patternName}).`)
      console.error('This script only works with SANDBOX credentials.')
      console.error(`\nFor sandbox setup instructions, see:\n${SANDBOX_DOC_URL}\n`)
      process.exit(1)
    }
  }

  // Additional heuristic: if it contains "live" or "production" in the value itself
  const lower = value.toLowerCase()
  if (lower.includes('live') || lower.includes('production')) {
    console.error(
      `\n[ERROR] ${name} appears to be a production credential (value mentions "live"/"production").`,
    )
    console.error('This script only works with SANDBOX credentials.')
    console.error(`\nFor sandbox setup instructions, see:\n${SANDBOX_DOC_URL}\n`)
    process.exit(1)
  }
}

async function fetchToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(`${SANDBOX_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (response.status === 401) {
    console.error('\n[ERROR] PayPal returned 401 Unauthorized.')
    console.error('Your PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is incorrect.')
    console.error(
      'Double-check the values in .env.local against your sandbox app at https://developer.paypal.com/\n',
    )
    process.exit(1)
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token request failed: ${response.status} ${error}`)
  }

  const data = (await response.json()) as TokenResponse
  return data.access_token
}

async function createSandboxOrder(token: string): Promise<string> {
  const response = await fetch(`${SANDBOX_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `smoke-test-${Date.now()}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          description: 'Smoke Test Order',
          amount: {
            currency_code: 'USD',
            value: '1.00',
          },
        },
      ],
    }),
  })

  if (response.status === 401) {
    console.error('\n[ERROR] PayPal returned 401 Unauthorized when creating order.')
    console.error('Your PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is incorrect.')
    console.error(
      'Double-check the values in .env.local against your sandbox app at https://developer.paypal.com/\n',
    )
    process.exit(1)
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Order creation failed: ${response.status} ${error}`)
  }

  const order = (await response.json()) as OrderResponse
  return order.id
}

async function voidOrder(token: string, orderId: string): Promise<void> {
  const response = await fetch(`${SANDBOX_API_BASE}/v2/checkout/orders/${orderId}/void`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok && response.status !== 204) {
    // 204 No Content is the success response for void
    const error = await response.text()
    throw new Error(`Order void failed: ${response.status} ${error}`)
  }
}

async function main() {
  console.log('\n🔍 PayPal Sandbox Keys Smoke Test')
  console.log('==================================\n')

  let clientId: string
  let clientSecret: string

  try {
    clientId = readEnv('PAYPAL_CLIENT_ID')
    clientSecret = readEnv('PAYPAL_CLIENT_SECRET')
  } catch (err) {
    console.error(`\n[ERROR] ${(err as Error).message}`)
    console.error('\nNo PayPal credentials found in .env.local.')
    console.error('This script requires the following env vars:')
    console.error('  PAYPAL_CLIENT_ID')
    console.error('  PAYPAL_CLIENT_SECRET')
    console.error(`\nFor setup instructions, see:\n${SANDBOX_DOC_URL}\n`)
    process.exit(1)
  }

  // Refuse to run with production-looking credentials
  detectProductionCredential('PAYPAL_CLIENT_ID', clientId)
  detectProductionCredential('PAYPAL_CLIENT_SECRET', clientSecret)

  console.log('✅ PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are set')
  console.log('✅ Credentials look like sandbox keys — proceeding\n')

  // Step 1: Get access token
  console.log('📡 Step 1: Fetching access token from PayPal sandbox...')
  const token = await fetchToken(clientId, clientSecret)
  console.log('✅ Access token received\n')

  // Step 2: Create a test order
  console.log('📡 Step 2: Creating a sandbox test order...')
  const orderId = await createSandboxOrder(token)
  console.log(`✅ Order created: ${orderId}\n`)

  // Step 3: Void the order
  console.log('📡 Step 3: Voiding the test order...')
  await voidOrder(token, orderId)
  console.log('✅ Order voided\n')

  // All good
  console.log('🎉 All PayPal sandbox checks passed!')
  console.log('\nYour PayPal sandbox credentials are configured correctly.')
  console.log(
    `\nFor more setup details (webhooks, sandbox buyer accounts), see:\n${SANDBOX_DOC_URL}\n`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(`\n[ERROR] Unexpected error: ${(err as Error).message}`)
  console.error(`\nFor sandbox setup instructions, see:\n${SANDBOX_DOC_URL}\n`)
  process.exit(1)
})
