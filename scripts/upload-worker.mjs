#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createRequire } from 'module'
import dotenv from 'dotenv'

const require = createRequire(import.meta.url)
const { put } = require('./../node_modules/@vercel/blob')

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const envLocalPath = join(__dirname, '..', '.env.local')
const envPath = join(__dirname, '..', '.env')

if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
} else if (existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

const BLOB_TOKEN = process.env.CDN_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN

if (!BLOB_TOKEN) {
  console.error('❌ Error: CDN_READ_WRITE_TOKEN environment variable not set')
  process.exit(1)
}

const VERSION = '4.4.168'

async function uploadWorker() {
  console.log('🚀 Uploading PDF.js worker to Vercel Blob...')
  console.log(`📦 PDF.js version: ${VERSION}\n`)

  const workerPath = join(__dirname, '..', 'tmp-pdfjs', 'build', 'pdf.worker.mjs')
  const remotePath = `pdfjs/${VERSION}/build/pdf.worker.mjs`

  try {
    console.log('📤 Uploading pdf.worker.mjs...')
    const content = readFileSync(workerPath)

    const blob = await put(remotePath, content, {
      access: 'public',
      contentType: 'application/javascript',
      addRandomSuffix: false,
      token: BLOB_TOKEN,
    })

    console.log(`   ✅ pdf.worker.mjs → ${blob.url}`)
    console.log('\n✨ Upload complete!')
  } catch (error) {
    console.error(`   ❌ Failed to upload:`, error.message)
    process.exit(1)
  }
}

uploadWorker().catch(console.error)
