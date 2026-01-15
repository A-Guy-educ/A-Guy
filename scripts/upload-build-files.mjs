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

async function uploadBuildFiles() {
  console.log('🚀 Uploading PDF.js build files to Vercel Blob...')
  console.log(`📦 PDF.js version: ${VERSION}\n`)

  const buildDir = join(__dirname, '..', 'tmp-pdfjs', 'build')

  const files = [
    'pdf.mjs',
    'pdf.worker.mjs',
    'pdf.worker.min.mjs',
    'pdf.min.mjs',
    'pdf.sandbox.mjs',
    'pdf.sandbox.min.mjs',
  ]

  for (const file of files) {
    const localPath = join(buildDir, file)

    if (!existsSync(localPath)) {
      console.log(`   ⚠️  ${file} not found, skipping...`)
      continue
    }

    const remotePath = `pdfjs/${VERSION}/build/${file}`

    try {
      console.log(`📤 Uploading ${file}...`)
      const content = readFileSync(localPath)

      const blob = await put(remotePath, content, {
        access: 'public',
        contentType: 'application/javascript',
        addRandomSuffix: false, // NO HASH - viewer expects exact filenames
        token: BLOB_TOKEN,
      })

      console.log(`   ✅ ${file} → ${blob.url}`)
    } catch (error) {
      console.error(`   ❌ Failed to upload ${file}:`, error.message)
    }
  }

  console.log('\n✨ Upload complete!')
}

uploadBuildFiles().catch(console.error)
