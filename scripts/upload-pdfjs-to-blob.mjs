#!/usr/bin/env node

/**
 * Upload PDF.js assets to Vercel Blob Storage
 *
 * This script uploads all PDF.js viewer files (viewer.html, viewer.mjs, viewer.css)
 * and assets (build/, web/images/, web/locale/, cmaps/, standard_fonts/) to Vercel Blob.
 *
 * Usage: node scripts/upload-pdfjs-to-blob.mjs
 *
 * Requirements:
 * - BLOB_READ_WRITE_TOKEN environment variable set
 * - pdfjs-dist package installed in node_modules
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createRequire } from 'module'
import dotenv from 'dotenv'

// Import @vercel/blob from pnpm nested node_modules
const require = createRequire(import.meta.url)
const { put } = require('./../node_modules/.pnpm/@vercel+blob@0.22.3/node_modules/@vercel/blob')

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local or .env
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
  console.error('')
  console.error('Get your token from:')
  console.error('1. Go to https://vercel.com/dashboard/stores')
  console.error('2. Select your CDN blob store: A-Guy-CDN')
  console.error('3. Click ".env.local" tab')
  console.error('4. Copy the CDN_READ_WRITE_TOKEN value')
  console.error('5. Add to your .env or .env.local file')
  console.error('')
  process.exit(1)
}

const PDFJS_VERSION = '4.4.168'
const PDFJS_DIR = join(__dirname, '..', 'node_modules', 'pdfjs-dist')
const SOURCE_VIEWER_DIR = join(__dirname, '..', 'public', 'pdfjs')

// Directories and files to upload from pdfjs-dist
const ASSETS_TO_UPLOAD = [
  'build/pdf.mjs',
  'build/pdf.min.mjs',
  'build/pdf.worker.mjs',
  'build/pdf.worker.min.mjs',
  'build/pdf.sandbox.mjs',
  'build/pdf.sandbox.min.mjs',
  'web/images',
  'web/locale',
  'cmaps',
  'standard_fonts',
]

// Viewer files to upload from public/pdfjs
const VIEWER_FILES = ['viewer.html', 'viewer.mjs', 'viewer.css']

/**
 * Recursively get all files in a directory
 */
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

/**
 * Upload a single file to Vercel Blob
 */
async function uploadFile(filePath, blobPath) {
  try {
    const content = readFileSync(filePath)
    const contentType = getContentType(filePath)

    const blob = await put(blobPath, content, {
      access: 'public',
      contentType,
      token: BLOB_TOKEN,
    })

    console.log(`✅ Uploaded: ${blobPath}`)
    return blob.url
  } catch (error) {
    console.error(`❌ Failed to upload ${blobPath}:`, error.message)
    throw error
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(filePath) {
  if (filePath.endsWith('.mjs') || filePath.endsWith('.js')) return 'application/javascript'
  if (filePath.endsWith('.css')) return 'text/css'
  if (filePath.endsWith('.html')) return 'text/html'
  if (filePath.endsWith('.json')) return 'application/json'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.gif')) return 'image/gif'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  if (filePath.endsWith('.bcmap')) return 'application/octet-stream'
  return 'application/octet-stream'
}

/**
 * Main upload process
 */
async function main() {
  console.log('🚀 Starting PDF.js upload to Vercel Blob...')
  console.log(`📦 PDF.js version: ${PDFJS_VERSION}`)
  console.log('')

  const uploadedUrls = {}

  // 1. Upload viewer files from public/pdfjs
  console.log('📤 Uploading viewer files from public/pdfjs...')

  if (!existsSync(SOURCE_VIEWER_DIR)) {
    console.error(`❌ Error: ${SOURCE_VIEWER_DIR} does not exist`)
    console.error('Please ensure viewer files exist in public/pdfjs/')
    process.exit(1)
  }

  for (const file of VIEWER_FILES) {
    const filePath = join(SOURCE_VIEWER_DIR, file)

    if (!existsSync(filePath)) {
      console.warn(`⚠️  Warning: ${file} not found, skipping...`)
      continue
    }

    const blobPath = `pdfjs/${PDFJS_VERSION}/${file}`

    try {
      const url = await uploadFile(filePath, blobPath)
      uploadedUrls[file] = url
    } catch (_error) {
      console.error(`Failed to upload viewer file: ${file}`)
      process.exit(1)
    }
  }

  console.log('')

  // 2. Upload assets from pdfjs-dist
  console.log('')
  console.log('📤 Uploading PDF.js assets from node_modules...')

  if (!existsSync(PDFJS_DIR)) {
    console.error(`❌ Error: pdfjs-dist not found in node_modules`)
    console.error('Please run: pnpm install pdfjs-dist')
    process.exit(1)
  }

  for (const asset of ASSETS_TO_UPLOAD) {
    const assetPath = join(PDFJS_DIR, asset)

    if (!existsSync(assetPath)) {
      console.warn(`⚠️  Warning: ${asset} not found, skipping...`)
      continue
    }

    const stat = statSync(assetPath)

    if (stat.isDirectory()) {
      // Upload all files in directory
      const files = getAllFiles(assetPath)
      console.log(`📁 Uploading ${files.length} files from ${asset}/...`)

      for (const file of files) {
        const blobPath = `pdfjs/${PDFJS_VERSION}/${asset}/${file.relativePath}`
        await uploadFile(file.path, blobPath)
      }
    } else {
      // Upload single file
      const blobPath = `pdfjs/${PDFJS_VERSION}/${asset}`
      const url = await uploadFile(assetPath, blobPath)
      uploadedUrls[asset] = url
    }
  }

  console.log('')
  console.log('✅ Upload complete!')
  console.log('')
  console.log('📋 Base URL for assets:')
  console.log(`   https://{your-blob-store}/pdfjs/${PDFJS_VERSION}/`)
  console.log('')
  console.log('🔗 Key URLs:')
  console.log(`   viewer.html:  ${uploadedUrls['viewer.html'] || 'N/A'}`)
  console.log(`   viewer.mjs:   ${uploadedUrls['viewer.mjs'] || 'N/A'}`)
  console.log(`   viewer.css:   ${uploadedUrls['viewer.css'] || 'N/A'}`)
  console.log(`   pdf.mjs:      ${uploadedUrls['build/pdf.mjs'] || 'N/A'}`)
  console.log(`   pdf.worker:   ${uploadedUrls['build/pdf.worker.mjs'] || 'N/A'}`)
  console.log('')
  console.log('⚠️  Next steps:')
  console.log('   1. Update viewer.html to load viewer.mjs and viewer.css from Blob URLs')
  console.log('   2. Update viewer.mjs to load pdf.mjs, worker, and assets from Blob URLs')
  console.log('   3. Update viewer.css to load images from Blob URLs')
  console.log('   4. Update React components to load viewer.html from Blob URL')
  console.log('   5. Remove public/pdfjs/ directory from repository')
}

main().catch((error) => {
  console.error('❌ Upload failed:', error)
  process.exit(1)
})
