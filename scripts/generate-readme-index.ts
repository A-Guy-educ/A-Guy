#!/usr/bin/env tsx
/**
 * README Index Generator
 *
 * Scans the codebase for all README files and generates an index
 * with metadata for AI agents to discover documentation.
 *
 * Run: pnpm tsx scripts/generate-readme-index.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

interface ReadmeEntry {
  path: string
  title: string
  sections: string[]
  relativeUrl: string
  category: string
  wordCount: number
}

interface ReadmeIndex {
  readmes: ReadmeEntry[]
  metadata: {
    generatedAt: string
    totalReadmes: number
    categories: Record<string, number>
  }
}

/**
 * Extract title from markdown content (first # heading)
 */
function extractTitle(content: string): string {
  const titleMatch = content.match(/^#\s+(.+)$/m)
  return titleMatch ? titleMatch[1] : 'Untitled'
}

/**
 * Extract all section headings (## level)
 */
function extractSections(content: string): string[] {
  const sections: string[] = []
  const headingRegex = /^##\s+(.+)$/gm
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    sections.push(match[1])
  }

  return sections
}

/**
 * Calculate word count (excluding code blocks)
 */
function calculateWordCount(content: string): number {
  // Remove code blocks
  const withoutCode = content.replace(/```[\s\S]*?```/g, '')
  // Count words
  return withoutCode.split(/\s+/).filter((word) => word.length > 0).length
}

/**
 * Determine category from file path
 */
function getCategory(filepath: string): string {
  const parts = filepath.split('/')

  if (parts[0] === 'docs') {
    return parts[1] || 'docs'
  }

  if (parts[0] === 'src') {
    return `src/${parts[1] || 'root'}`
  }

  if (filepath === 'README.md') {
    return 'root'
  }

  return parts[0] || 'other'
}

/**
 * Recursively find all README files
 */
function findReadmeFiles(dir: string, relativePath = ''): string[] {
  const results: string[] = []
  const ignorePatterns = ['node_modules', '.next', 'dist', 'build', '.git']

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name

      if (entry.isDirectory()) {
        // Skip ignored directories
        if (ignorePatterns.includes(entry.name)) {
          continue
        }
        // Recursively search subdirectories
        results.push(...findReadmeFiles(fullPath, relPath))
      } else if (entry.isFile()) {
        // Check if it's a README file
        if (entry.name === 'README.md' || entry.name === 'readme.md') {
          results.push(relPath)
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return results
}

/**
 * Generate README index
 */
function generateReadmeIndex(): void {
  console.log('🔍 Scanning for README files...')

  const readmes = findReadmeFiles(ROOT_DIR)

  console.log(`📚 Found ${readmes.length} README files`)

  const entries: ReadmeEntry[] = []
  const categories: Record<string, number> = {}

  for (const filepath of readmes) {
    const fullPath = path.join(ROOT_DIR, filepath)
    const content = fs.readFileSync(fullPath, 'utf-8')

    const entry: ReadmeEntry = {
      path: filepath,
      title: extractTitle(content),
      sections: extractSections(content),
      relativeUrl: filepath.replace(/^docs\//, ''),
      category: getCategory(filepath),
      wordCount: calculateWordCount(content),
    }

    entries.push(entry)

    // Track category counts
    categories[entry.category] = (categories[entry.category] || 0) + 1
  }

  // Sort by category, then by path
  entries.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category)
    }
    return a.path.localeCompare(b.path)
  })

  const index: ReadmeIndex = {
    readmes: entries,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalReadmes: entries.length,
      categories,
    },
  }

  // Ensure output directory exists
  const outputDir = path.join(ROOT_DIR, '.ai-docs', 'indexes')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write index file
  const outputPath = path.join(outputDir, 'readme-index.json')
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2))

  console.log(`✅ Generated README index: ${outputPath}`)
  console.log(`📊 Total READMEs: ${index.metadata.totalReadmes}`)
  console.log(`📁 Categories:`)

  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   - ${category}: ${count}`)
    })

  // Show some example entries
  console.log(`\n📄 Sample entries:`)
  entries.slice(0, 3).forEach((entry) => {
    console.log(`   - ${entry.title} (${entry.path})`)
    console.log(`     Sections: ${entry.sections.length}, Words: ${entry.wordCount}`)
  })
}

// Run
try {
  generateReadmeIndex()
} catch (error) {
  console.error('❌ Failed to generate README index:', error)
  process.exit(1)
}
