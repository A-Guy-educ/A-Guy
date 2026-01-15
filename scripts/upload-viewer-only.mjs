#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createRequire } from 'module'
import dotenv from 'dotenv'

// Import @vercel/blob
const require = createRequire(import.meta.url)
const { put } = require('./../node_modules/@vercel/blob')

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
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

async function uploadViewerFiles() {
  console.log('🚀 Uploading viewer files to Vercel Blob...')
  console.log(`📦 PDF.js version: ${VERSION}\n`)

  const viewerDir = join(__dirname, '..', 'tmp-pdfjs', 'web')

  const files = [
    { local: 'viewer.html', remote: 'viewer.html' },
    { local: 'viewer.mjs', remote: 'viewer.mjs' },
    { local: 'viewer.css', remote: 'viewer.css' },
  ]

  const uploadedUrls = {}

  for (const file of files) {
    const localPath = join(viewerDir, file.local)
    const remotePath = `pdfjs/${VERSION}/${file.remote}`

    try {
      console.log(`📤 Uploading ${file.local}...`)
      const content = readFileSync(localPath)
      const contentType = file.local.endsWith('.mjs')
        ? 'application/javascript'
        : file.local.endsWith('.css')
          ? 'text/css'
          : 'text/html'

      const blob = await put(remotePath, content, {
        access: 'public',
        contentType,
        addRandomSuffix: true,
        token: BLOB_TOKEN,
      })

      uploadedUrls[file.local] = blob.url
      console.log(`   ✅ ${file.local} → ${blob.url}`)
    } catch (error) {
      console.error(`   ❌ Failed to upload ${file.local}:`, error.message)
    }
  }

  console.log('\n✨ Upload complete!\n')
  console.log('🔗 New URLs:')
  Object.entries(uploadedUrls).forEach(([name, url]) => {
    console.log(`   ${name}: ${url}`)
  })
  console.log('\n⚠️  Update src/app/api/pdfjs-viewer/route.ts with these new URLs')
}

uploadViewerFiles().catch(console.error)
