/**
 * @fileType utility
 * @domain inspector
 * @pattern code-reuse-analyzer
 * @ai-summary Analyzes code reuse and DRY compliance — duplicate code blocks, copy-paste patterns, missing abstractions
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Logger } from 'pino'

export interface CodeReuseIssue {
  dimension: 'code-reuse'
  priority: 'critical' | 'warning' | 'info'
  description: string
  impact?: string
  recommendation?: string
  file?: string
}

interface CodeReuseResult {
  issues: CodeReuseIssue[]
  metrics: {
    duplicateBlocks: number
    copyPastedCode: number
    missingAbstractions: number
    barrelFileIssues: number
  }
}

// Minimum lines for a block to be considered for duplication detection
const MIN_DUPLICATE_LINES = 5

function normalizeCode(code: string): string {
  // Remove comments
  let normalized = code.replace(/\/\/.*$/gm, '')
  normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '')

  // Remove strings
  normalized = normalized.replace(/'[^']*'/g, "''")
  normalized = normalized.replace(/"[^"]*"/g, '""')

  // Remove template literals
  normalized = normalized.replace(/`[^`]*`/g, '``')

  // Remove numbers (but keep structure)
  normalized = normalized.replace(/\b\d+\b/g, '0')

  // Remove whitespace variations
  normalized = normalized.replace(/\s+/g, ' ').trim()

  return normalized
}

function findDuplicateBlocks(dir: string): Array<{ block: string; files: string[] }> {
  const codeBlocks = new Map<string, Set<string>>()

  function processFile(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      // Sliding window to find duplicate blocks
      for (let i = 0; i < lines.length - MIN_DUPLICATE_LINES; i++) {
        const blockLines = lines.slice(i, i + MIN_DUPLICATE_LINES)
        const block = normalizeCode(blockLines.join('\n'))

        if (block.length > MIN_DUPLICATE_LINES * 2) {
          // Skip if block is mostly whitespace
          const nonWhitespaceChars = block.replace(/\s/g, '').length
          if (nonWhitespaceChars < MIN_DUPLICATE_LINES * 2) continue

          if (!codeBlocks.has(block)) {
            codeBlocks.set(block, new Set())
          }
          codeBlocks.get(block)!.add(filePath.replace(process.cwd(), ''))
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        processFile(fullPath)
      }
    }
  }

  traverse(dir)

  // Filter to only blocks that appear in multiple files
  const duplicates: Array<{ block: string; files: string[] }> = []
  for (const [block, files] of codeBlocks) {
    if (files.size > 1) {
      duplicates.push({ block, files: Array.from(files) })
    }
  }

  return duplicates.slice(0, 10) // Top 10 duplicates
}

function findMissingAbstractions(dir: string): Array<{ file: string; patterns: string[] }> {
  const results: Array<{ file: string; patterns: string[] }> = []

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const patterns: string[] = []

          // Check for repeated conditional patterns
          const conditionalReturns = content.match(/if\s*\([^)]*\)\s*\{\s*return\s+[^;]+;/g) || []
          if (conditionalReturns.length > 3) {
            patterns.push(`${conditionalReturns.length}x similar conditional returns`)
          }

          // Check for repeated try-catch patterns
          const tryCatchBlocks = content.match(/try\s*\{[\s\S]*?\}\s*catch/g) || []
          const consoleInCatch = content.match(/catch[^{]*\{[^}]*console\.\w+/g) || []
          if (tryCatchBlocks.length > 2 && consoleInCatch.length === tryCatchBlocks.length) {
            patterns.push(`${tryCatchBlocks.length}x identical try-catch patterns`)
          }

          if (patterns.length > 0) {
            results.push({
              file: fullPath.replace(process.cwd(), ''),
              patterns,
            })
          }
        } catch {
          // Skip
        }
      }
    }
  }

  traverse(dir)
  return results
}

function findBarrelFileIssues(dir: string): Array<{ file: string; issue: string }> {
  const results: Array<{ file: string; issue: string }> = []

  function checkBarrelFile(filePath: string): string | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')

      // Check if barrel file re-exports everything (anti-pattern)
      const reExports = content.match(/export\s+\*\s+from/g) || []

      if (reExports.length > 3) {
        return `Excessive wildcard re-exports (${reExports.length})`
      }

      // Check for circular re-exports (barrel imports from barrel)
      const selfImports = content.match(new RegExp(`from\\s+['"]\\.\\/index['"]`, 'g')) || []
      if (selfImports.length > 0) {
        return 'Barrel importing from itself'
      }

      return null
    } catch {
      return null
    }
  }

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && entry.name === 'index.ts') {
        const issue = checkBarrelFile(fullPath)
        if (issue) {
          results.push({
            file: fullPath.replace(process.cwd(), ''),
            issue,
          })
        }
      }
    }
  }

  traverse(dir)
  return results
}

function findCopyPastedCode(dir: string): Array<{ snippet: string; files: string[] }> {
  // Similar to duplicate blocks but looks for exact matches (including variable names)
  const exactBlocks = new Map<string, Set<string>>()

  function processFile(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length - MIN_DUPLICATE_LINES; i++) {
        const blockLines = lines.slice(i, i + MIN_DUPLICATE_LINES)
        const block = blockLines.join('\n')

        // Only look for blocks with low entropy (very similar structure)
        const nonWhitespaceChars = block.replace(/\s/g, '')
        if (nonWhitespaceChars.length < MIN_DUPLICATE_LINES * 2) continue

        if (!exactBlocks.has(block)) {
          exactBlocks.set(block, new Set())
        }
        exactBlocks.get(block)!.add(filePath.replace(process.cwd(), ''))
      }
    } catch {
      // Skip
    }
  }

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        processFile(fullPath)
      }
    }
  }

  traverse(dir)

  const copies: Array<{ snippet: string; files: string[] }> = []
  for (const [snippet, files] of exactBlocks) {
    if (files.size > 1) {
      copies.push({ snippet, files: Array.from(files) })
    }
  }

  return copies.slice(0, 5)
}

export function analyzeCodeReuse(dir: string, _log: Logger): CodeReuseResult {
  const issues: CodeReuseIssue[] = []

  const duplicateBlocks = findDuplicateBlocks(dir)
  const missingAbstractions = findMissingAbstractions(dir)
  const barrelFileIssues = findBarrelFileIssues(dir)
  const copyPastedCode = findCopyPastedCode(dir)

  for (const { block, files } of duplicateBlocks) {
    // Truncate block for display
    const displayBlock = block.length > 100 ? block.slice(0, 100) + '...' : block
    issues.push({
      dimension: 'code-reuse',
      priority: 'warning',
      description: `Duplicate code block in ${files.length} files: ${displayBlock.replace(/\n/g, ' ').slice(0, 60)}...`,
      impact: 'Duplicated code increases maintenance burden and introduces inconsistency',
      recommendation: 'Extract to shared utility or helper function',
      file: files[0],
    })
  }

  for (const { file, patterns } of missingAbstractions) {
    issues.push({
      dimension: 'code-reuse',
      priority: 'info',
      description: `Possible missing abstraction in ${file}: ${patterns.join(', ')}`,
      impact: 'Repeated patterns suggest an abstraction is missing',
      recommendation: 'Consider extracting a shared helper or utility function',
      file,
    })
  }

  for (const { file, issue } of barrelFileIssues) {
    issues.push({
      dimension: 'code-reuse',
      priority: 'info',
      description: `Barrel file issue in ${file}: ${issue}`,
      impact: 'Problematic barrel files can cause circular dependencies and slow builds',
      recommendation: 'Review barrel file structure and consider direct imports',
      file,
    })
  }

  for (const { files } of copyPastedCode) {
    issues.push({
      dimension: 'code-reuse',
      priority: 'warning',
      description: `Potential copy-paste: ${files.length} files contain the same ${MIN_DUPLICATE_LINES}+ lines`,
      impact: 'Copy-pasted code is harder to maintain and indicates code smell',
      recommendation: 'Refactor to share the code in a single location',
      file: files[0],
    })
  }

  return {
    issues,
    metrics: {
      duplicateBlocks: duplicateBlocks.length,
      copyPastedCode: copyPastedCode.length,
      missingAbstractions: missingAbstractions.length,
      barrelFileIssues: barrelFileIssues.length,
    },
  }
}
