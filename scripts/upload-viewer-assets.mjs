#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
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

function getAllFiles(dir, baseDir = dir) {
  const files = []
  const items = readdirSync(dir)

  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir))
    } else {
      files.push({
        path: fullPath,
        relativePath: relative(baseDir, fullPath).replace(/\\/g, '/'),
      })
    }
  }

  return files
}

function getContentType(filePath) {
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.gif')) return 'image/gif'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  if (filePath.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

async function uploadAssets() {
  console.log('🚀 Uploading PDF.js viewer assets to Vercel Blob...')
  console.log(`📦 PDF.js version: ${VERSION}\n`)

  const webDir = join(__dirname, '..', 'tmp-pdfjs', 'web')

  // Upload images directory
  const imagesDir = join(webDir, 'images')
  if (existsSync(imagesDir)) {
    const imageFiles = getAllFiles(imagesDir)
    console.log(`📁 Uploading ${imageFiles.length} image files...\n`)

    for (const file of imageFiles) {
      const remotePath = `pdfjs/${VERSION}/web/images/${file.relativePath}`

      try {
        const content = readFileSync(file.path)
        const contentType = getContentType(file.path)

        await put(remotePath, content, {
          access: 'public',
          contentType,
          addRandomSuffix: false, // Keep original filenames for images
          token: BLOB_TOKEN,
        })

        console.log(`   ✅ ${file.relativePath}`)
      } catch (error) {
        console.error(`   ❌ Failed to upload ${file.relativePath}:`, error.message)
      }
    }
  }

  console.log('\n✨ Upload complete!')
}

uploadAssets().catch(console.error)
