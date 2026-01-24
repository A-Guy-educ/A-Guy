#!/usr/bin/env tsx
/**
 * Pattern Index Generator
 *
 * Scans the codebase and generates an index of code patterns.
 * Helps AI agents quickly find examples of specific patterns.
 *
 * Run: pnpm tsx scripts/generate-pattern-index.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

interface FileMetadata {
  path: string
  type: 'collection-config' | 'component' | 'endpoint' | 'utility' | 'hook' | 'unknown'
  domain: string
  patterns: string[]
  aiSummary: string
  dependencies: string[]
}

interface PatternExample {
  pattern: string
  description: string
  files: string[]
  template?: string
  documentation?: string
}

interface PatternIndex {
  patterns: Record<string, PatternExample>
  fileMetadata: Record<string, FileMetadata>
  metadata: {
    generatedAt: string
    totalFiles: number
    totalPatterns: number
  }
}

/**
 * Extract metadata from file header comments
 */
function extractFileMetadata(filePath: string, content: string): FileMetadata | null {
  const metadata: FileMetadata = {
    path: filePath,
    type: 'unknown',
    domain: 'general',
    patterns: [],
    aiSummary: '',
    dependencies: [],
  }

  // Match JSDoc-style file header
  const headerMatch = content.match(/\/\*\*\s*\n([\s\S]*?)\*\//)
  if (!headerMatch) return null

  const header = headerMatch[1]

  // Extract @fileType
  const fileTypeMatch = header.match(/@fileType\s+([^\n]+)/)
  if (fileTypeMatch) {
    metadata.type = fileTypeMatch[1].trim() as FileMetadata['type']
  }

  // Extract @domain
  const domainMatch = header.match(/@domain\s+([^\n]+)/)
  if (domainMatch) {
    metadata.domain = domainMatch[1].trim()
  }

  // Extract @pattern
  const patternMatch = header.match(/@pattern\s+([^\n]+)/)
  if (patternMatch) {
    metadata.patterns = patternMatch[1].split(',').map((p) => p.trim())
  }

  // Extract @ai-summary
  const summaryMatch = header.match(/@ai-summary\s+([^\n]+)/)
  if (summaryMatch) {
    metadata.aiSummary = summaryMatch[1].trim()
  }

  return metadata
}

/**
 * Detect patterns automatically from file content
 */
function detectPatterns(filePath: string, content: string): string[] {
  const patterns: string[] = []

  // Collection patterns
  if (content.includes('CollectionConfig')) {
    if (content.includes('publishedAt') && content.includes('isPublished')) {
      patterns.push('published-content')
    }
    if (content.includes('owner') && content.includes('isOwner')) {
      patterns.push('user-owned')
    }
    if (content.includes('roles') && content.includes('isAdmin')) {
      patterns.push('rbac')
    }
    if (content.includes('order') && content.includes('relationship')) {
      patterns.push('hierarchical-data')
    }
    if (content.match(/access:\s*\{/)) {
      patterns.push('access-control')
    }
  }

  // Component patterns
  if (content.includes('className') && content.includes('cn(')) {
    patterns.push('tailwind-component')
  }
  if (content.includes('cva(') || content.includes('class-variance-authority')) {
    patterns.push('variant-component')
  }
  if (content.includes('useTranslations')) {
    patterns.push('i18n-component')
  }
  if (content.includes("'use client'")) {
    patterns.push('client-component')
  }

  // Endpoint patterns
  if (content.includes('NextRequest') && content.includes('NextResponse')) {
    patterns.push('api-endpoint')
  }
  if (content.includes('payload.auth')) {
    patterns.push('authenticated-endpoint')
  }
  if (content.includes('z.object') && content.includes('parse')) {
    patterns.push('validated-endpoint')
  }

  // Hook patterns
  if (content.includes('beforeChange') || content.includes('afterChange')) {
    patterns.push('payload-hooks')
  }

  return patterns
}

/**
 * Extract dependencies from imports
 */
function extractDependencies(content: string): string[] {
  const deps: string[] = []
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g

  let match
  while ((match = importRegex.exec(content)) !== null) {
    const dep = match[1]
    // Only include external dependencies (not relative imports)
    if (!dep.startsWith('.') && !dep.startsWith('@/')) {
      deps.push(dep)
    }
  }

  return [...new Set(deps)] // Remove duplicates
}

/**
 * Scan directory for TypeScript files
 */
function* scanDirectory(dir: string): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    // Skip node_modules, .next, etc.
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.next') {
      continue
    }

    if (entry.isDirectory()) {
      yield* scanDirectory(fullPath)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      yield fullPath
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Generating pattern index...\n')

  const patternIndex: PatternIndex = {
    patterns: {},
    fileMetadata: {},
    metadata: {
      generatedAt: new Date().toISOString(),
      totalFiles: 0,
      totalPatterns: 0,
    },
  }

  // Scan src directory
  const srcDir = path.join(ROOT_DIR, 'src')
  let fileCount = 0

  for (const filePath of scanDirectory(srcDir)) {
    fileCount++
    const content = fs.readFileSync(filePath, 'utf-8')
    const relativePath = path.relative(ROOT_DIR, filePath)

    // Extract metadata from header
    const headerMetadata = extractFileMetadata(relativePath, content)

    // Detect patterns automatically
    const detectedPatterns = detectPatterns(relativePath, content)

    // Extract dependencies
    const dependencies = extractDependencies(content)

    // Combine metadata
    const metadata: FileMetadata = headerMetadata || {
      path: relativePath,
      type: 'unknown',
      domain: 'general',
      patterns: detectedPatterns,
      aiSummary: '',
      dependencies,
    }

    // Add detected patterns to header patterns
    metadata.patterns = [...new Set([...metadata.patterns, ...detectedPatterns])]
    metadata.dependencies = dependencies

    // Only index files with patterns
    if (metadata.patterns.length > 0) {
      patternIndex.fileMetadata[relativePath] = metadata

      // Add to pattern index
      metadata.patterns.forEach((pattern) => {
        if (!patternIndex.patterns[pattern]) {
          patternIndex.patterns[pattern] = {
            pattern,
            description: getPatternDescription(pattern),
            files: [],
          }
        }
        patternIndex.patterns[pattern].files.push(relativePath)
      })
    }
  }

  // Update metadata
  patternIndex.metadata.totalFiles = Object.keys(patternIndex.fileMetadata).length
  patternIndex.metadata.totalPatterns = Object.keys(patternIndex.patterns).length

  // Sort files in each pattern
  Object.values(patternIndex.patterns).forEach((pattern) => {
    pattern.files.sort()
  })

  // Ensure output directory exists
  const outputDir = path.join(ROOT_DIR, '.ai-docs/indexes')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write output
  const outputPath = path.join(outputDir, 'pattern-index.json')
  fs.writeFileSync(outputPath, JSON.stringify(patternIndex, null, 2), 'utf-8')

  console.log(`✅ Scanned ${fileCount} TypeScript files`)
  console.log(`✅ Indexed ${patternIndex.metadata.totalFiles} files with patterns`)
  console.log(`✅ Found ${patternIndex.metadata.totalPatterns} unique patterns`)
  console.log(`📁 Output: ${path.relative(ROOT_DIR, outputPath)}\n`)

  // Print pattern statistics
  console.log('📊 Patterns found:')
  const sortedPatterns = Object.entries(patternIndex.patterns).sort(
    (a, b) => b[1].files.length - a[1].files.length,
  )

  sortedPatterns.forEach(([pattern, data]) => {
    console.log(`   ${pattern}: ${data.files.length} files`)
  })

  // Print top patterns with examples
  console.log('\n🔝 Top 5 patterns with examples:')
  sortedPatterns.slice(0, 5).forEach(([pattern, data]) => {
    console.log(`\n   ${pattern} (${data.files.length} files)`)
    console.log(`   Description: ${data.description}`)
    console.log(`   Examples:`)
    data.files.slice(0, 3).forEach((file) => {
      console.log(`      - ${file}`)
    })
  })
}

/**
 * Get human-readable description for a pattern
 */
function getPatternDescription(pattern: string): string {
  const descriptions: Record<string, string> = {
    'published-content': 'Collection with publishedAt field and isPublished access control',
    'user-owned': 'Collection with owner field and isOwner access control',
    rbac: 'Role-based access control with admin/user roles',
    'hierarchical-data': 'Parent-child relationships with order field',
    'access-control': 'Explicit access control defined for CRUD operations',
    'tailwind-component': 'Component using Tailwind CSS utilities',
    'variant-component': 'Component with CVA variants',
    'i18n-component': 'Component with internationalization support',
    'client-component': 'Client-side React component with interactivity',
    'api-endpoint': 'Next.js API route handler',
    'authenticated-endpoint': 'API endpoint requiring authentication',
    'validated-endpoint': 'API endpoint with Zod validation',
    'payload-hooks': 'Payload lifecycle hooks (beforeChange, afterChange, etc.)',
  }

  return descriptions[pattern] || 'No description available'
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { detectPatterns, extractDependencies, extractFileMetadata }
export type { FileMetadata, PatternExample, PatternIndex }
