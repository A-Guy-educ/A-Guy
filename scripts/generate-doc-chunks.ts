#!/usr/bin/env tsx
/**
 * Documentation Chunk Generator
 *
 * Splits markdown documentation into searchable chunks with metadata.
 * Run: pnpm tsx scripts/generate-doc-chunks.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..')

interface DocChunk {
  id: string
  title: string
  content: string
  keywords: string[]
  category: string
  sourceFile: string
  startLine?: number
  endLine?: number
  priority: number // Higher = more important
}

interface DocChunks {
  chunks: DocChunk[]
  metadata: {
    generatedAt: string
    totalChunks: number
    sourceFiles: string[]
  }
}

/**
 * Extract sections from markdown content
 */
function extractMarkdownSections(content: string, filePath: string): DocChunk[] {
  const chunks: DocChunk[] = []
  const lines = content.split('\n')

  let currentSection: {
    title: string
    content: string[]
    startLine: number
    level: number
  } | null = null

  let lineNumber = 0

  for (const line of lines) {
    lineNumber++

    // Check if this is a heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      // Save previous section if exists
      if (currentSection && currentSection.content.length > 0) {
        chunks.push(createChunk(currentSection, filePath, lineNumber))
      }

      // Start new section
      currentSection = {
        title: headingMatch[2],
        content: [],
        startLine: lineNumber,
        level: headingMatch[1].length
      }
    } else if (currentSection) {
      // Add line to current section
      currentSection.content.push(line)
    }
  }

  // Save last section
  if (currentSection && currentSection.content.length > 0) {
    chunks.push(createChunk(currentSection, filePath, lineNumber))
  }

  return chunks
}

/**
 * Create a doc chunk from a section
 */
function createChunk(
  section: { title: string; content: string[]; startLine: number; level: number },
  filePath: string,
  endLine: number
): DocChunk {
  const content = section.content.join('\n').trim()
  const fileName = path.basename(filePath, '.md')

  // Generate ID
  const id = `${fileName}-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  // Extract keywords from title and content
  const keywords = extractKeywords(section.title + ' ' + content)

  // Determine category based on file name and content
  const category = determineCategory(filePath, section.title, content)

  // Determine priority (higher level headings = higher priority)
  const priority = 10 - section.level + (fileName === 'CHEAT-SHEET' ? 5 : 0)

  return {
    id,
    title: section.title,
    content,
    keywords,
    category,
    sourceFile: path.basename(filePath),
    startLine: section.startLine,
    endLine,
    priority
  }
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'be', 'been', 'are',
    'this', 'that', 'these', 'those', 'it', 'its', 'you', 'your', 'we',
    'how', 'what', 'when', 'where', 'why', 'which', 'who'
  ])

  // Extract words and filter
  const words = text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word =>
      word.length > 3 &&
      !commonWords.has(word) &&
      !word.match(/^\d+$/)
    )

  // Count frequency and take top keywords
  const frequency = new Map<string, number>()
  words.forEach(word => {
    frequency.set(word, (frequency.get(word) || 0) + 1)
  })

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

/**
 * Determine category based on content
 */
function determineCategory(filePath: string, title: string, content: string): string {
  const fileName = path.basename(filePath, '.md').toLowerCase()
  const text = (title + ' ' + content).toLowerCase()

  // File-based categories
  if (fileName === 'cheat-sheet') return 'quick-reference'
  if (fileName === 'agents') return 'patterns'
  if (fileName === 'design_system') return 'styling'
  if (fileName === 'styling-guide') return 'styling'
  if (fileName === 'claude') return 'quick-reference'

  // Content-based categories
  if (text.includes('collection') && text.includes('slug')) return 'collections'
  if (text.includes('component') && text.includes('react')) return 'components'
  if (text.includes('endpoint') && text.includes('api')) return 'endpoints'
  if (text.includes('access') && text.includes('control')) return 'security'
  if (text.includes('test') && text.includes('vitest')) return 'testing'
  if (text.includes('hook') && text.includes('before')) return 'hooks'
  if (text.includes('tailwind') || text.includes('css')) return 'styling'

  return 'general'
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Generating documentation chunks...\n')

  const docChunks: DocChunks = {
    chunks: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      totalChunks: 0,
      sourceFiles: []
    }
  }

  // Documentation files to process
  const docFiles = [
    'AGENTS.md',
    'DESIGN_SYSTEM.md',
    'CLAUDE.md',
    'STYLING-GUIDE.md',
    'docs/ai/quick-reference/CHEAT-SHEET.md'
  ]

  // Process each file
  for (const docFile of docFiles) {
    const filePath = path.join(ROOT_DIR, docFile)

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${docFile} (not found)`)
      continue
    }

    console.log(`📄 Processing ${docFile}...`)

    const content = fs.readFileSync(filePath, 'utf-8')
    const chunks = extractMarkdownSections(content, filePath)

    docChunks.chunks.push(...chunks)
    docChunks.metadata.sourceFiles.push(docFile)

    console.log(`   ✅ Extracted ${chunks.length} chunks`)
  }

  // Update metadata
  docChunks.metadata.totalChunks = docChunks.chunks.length

  // Ensure output directory exists
  const outputDir = path.join(ROOT_DIR, 'docs/ai/indexes')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write output
  const outputPath = path.join(outputDir, 'doc-chunks.json')
  fs.writeFileSync(
    outputPath,
    JSON.stringify(docChunks, null, 2),
    'utf-8'
  )

  console.log(`\n✅ Generated ${docChunks.metadata.totalChunks} documentation chunks`)
  console.log(`📁 Output: ${path.relative(ROOT_DIR, outputPath)}`)

  // Print statistics
  const categories = new Map<string, number>()
  docChunks.chunks.forEach(chunk => {
    categories.set(chunk.category, (categories.get(chunk.category) || 0) + 1)
  })

  console.log('\n📊 Chunks by category:')
  Array.from(categories.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`)
    })
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { extractMarkdownSections, extractKeywords, determineCategory }
export type { DocChunk, DocChunks }
