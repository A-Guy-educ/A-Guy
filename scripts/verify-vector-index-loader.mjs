#!/usr/bin/env node
/**
 * Loader for verify-vector-index.ts
 * This file loads environment variables before importing the main script
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

// Load env vars
config({ path: resolve(rootDir, '.env.local') })
config({ path: resolve(rootDir, '.env') })

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment')
  console.error('   Checked: .env.local and .env')
  console.error('   Please ensure DATABASE_URL is set in one of these files')
  process.exit(1)
}

// Now dynamically import and run the main script
import('./verify-vector-index.ts')
  .then(() => {
    // Script will handle its own exit
  })
  .catch((error) => {
    console.error('❌ Failed to run verification script:')
    console.error(error)
    process.exit(1)
  })
