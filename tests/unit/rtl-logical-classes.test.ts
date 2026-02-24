import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Directories to scan
const SCAN_DIRS = ['src/ui/web', 'src/ui/cody', 'src/app/(frontend)']

// Files/directories to exclude from scanning
const EXCLUDE_PATTERNS = ['node_modules', '.next', 'dist', 'build']

// Allowlist: patterns that should NOT be flagged as violations
// These are either not directional layout or are preserved per spec
const ALLOWLIST = [
  // Spinner visual arc trick
  'border-r-transparent',
  // Modal centering pattern
  'left-[50%]',
  'translate-x-[-50%]',
  // CommandPalette, PlanCard, ExerciseHeader centering
  'left-1/2',
  '-translate-x-1/2',
  // Dialog close button positioning (PRESERVED per spec FR-003)
  'right-4',
  'top-4',
  // Icon positioning inside input/button elements (PRESERVED per spec FR-003)
  'left-2',
  // Radix UI animation keyframes
  'slide-out-to-left',
  'slide-in-from-left',
  // Radix UI side-aware animation directives
  'data-[side=left]',
  'data-[side=right]',
  // Translate transforms that are not directional (for animation offsets)
  'translate-x-0',
  '-translate-x-1',
  'translate-x-1',
  // Modal centering
  'translate-x-[-50]',
  // Negative positioning for modal/side panel alignment
  '-left-1',
  '-right-2',
  // Absolute positioning for elements that need specific side placement
  'left-0',
  'right-0',
  'left-1',
  'right-1',
  'right-2',
  'left-4',
  'right-4',
  'left-5',
  'right-5',
  'left-6',
  'right-6',
]

// Helper to check if a match is allowlisted
function isAllowlisted(match: string): boolean {
  return ALLOWLIST.some((pattern) => match.includes(pattern))
}

// Get all TypeScript/TSX files in directories
function getFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    // Skip excluded patterns
    if (EXCLUDE_PATTERNS.some((pattern) => fullPath.includes(pattern))) {
      continue
    }

    if (entry.isDirectory()) {
      getFiles(fullPath, files)
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

describe('RTL Logical CSS Classes', () => {
  // Get all files to scan
  const allFiles = SCAN_DIRS.flatMap((dir) => getFiles(dir))

  describe('physical margin classes (ml-/mr-)', () => {
    it('should not contain physical margin classes in frontend components', () => {
      const violations: { file: string; match: string; line: number }[] = []
      const regex = /\b(-)?ml-\d+|-ml-\d+|\b(-)?mr-\d+|-mr-\d+/g

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          const matches = line.match(regex) || []
          for (const match of matches) {
            if (!isAllowlisted(match)) {
              violations.push({
                file: path.relative(process.cwd(), file),
                match,
                line: index + 1,
              })
            }
          }
        })
      }

      if (violations.length > 0) {
        const formatted = violations.map((v) => `  ${v.file}:${v.line}: ${v.match}`).join('\n')
        expect.fail(`Found ${violations.length} physical margin class(es):\n${formatted}`)
      }
    })
  })

  describe('physical padding classes (pl-/pr-)', () => {
    it('should not contain physical padding classes in frontend components', () => {
      const violations: { file: string; match: string; line: number }[] = []
      const regex = /\bpl-\d+|\bpr-\d+/g

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          const matches = line.match(regex) || []
          for (const match of matches) {
            if (!isAllowlisted(match)) {
              violations.push({
                file: path.relative(process.cwd(), file),
                match,
                line: index + 1,
              })
            }
          }
        })
      }

      if (violations.length > 0) {
        const formatted = violations.map((v) => `  ${v.file}:${v.line}: ${v.match}`).join('\n')
        expect.fail(`Found ${violations.length} physical padding class(es):\n${formatted}`)
      }
    })
  })

  describe('physical positioning classes (left-/right-)', () => {
    it('should not contain physical positioning classes except centering and fixed offsets', () => {
      const violations: { file: string; match: string; line: number }[] = []
      // Match left-* and right-* but exclude allowlisted patterns
      const regex = /\b(-)?left-\d+|-left-\d+|\b(-)?right-\d+|-right-\d+/g

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          const matches = line.match(regex) || []
          for (const match of matches) {
            if (!isAllowlisted(match)) {
              violations.push({
                file: path.relative(process.cwd(), file),
                match,
                line: index + 1,
              })
            }
          }
        })
      }

      if (violations.length > 0) {
        const formatted = violations.map((v) => `  ${v.file}:${v.line}: ${v.match}`).join('\n')
        expect.fail(`Found ${violations.length} physical positioning class(es):\n${formatted}`)
      }
    })
  })

  describe('physical text alignment (text-left/text-right)', () => {
    it('should not contain physical text alignment classes', () => {
      const violations: { file: string; match: string; line: number }[] = []
      const regex = /\btext-left\b|\btext-right\b/g

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          const matches = line.match(regex) || []
          for (const match of matches) {
            violations.push({
              file: path.relative(process.cwd(), file),
              match,
              line: index + 1,
            })
          }
        })
      }

      if (violations.length > 0) {
        const formatted = violations.map((v) => `  ${v.file}:${v.line}: ${v.match}`).join('\n')
        expect.fail(`Found ${violations.length} physical text alignment class(es):\n${formatted}`)
      }
    })
  })

  describe('physical border/rounded directional classes', () => {
    it('should not contain physical border/rounded directional classes', () => {
      const violations: { file: string; match: string; line: number }[] = []
      const regex =
        /\bborder-l-\w+|\bborder-r-\w+|\brounded-bl-|\brounded-br-|\brounded-tl-|\brounded-tr-|\brounded-l-|\brounded-r-/g

      // Additional allowlist for border/rounded
      const borderRoundedAllowlist = [
        'border-r-transparent', // Spinner visual arc trick
      ]

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          const matches = line.match(regex) || []
          for (const match of matches) {
            // Skip if in allowlist
            if (borderRoundedAllowlist.some((allowed) => match.includes(allowed))) {
              continue
            }
            violations.push({
              file: path.relative(process.cwd(), file),
              match,
              line: index + 1,
            })
          }
        })
      }

      if (violations.length > 0) {
        const formatted = violations.map((v) => `  ${v.file}:${v.line}: ${v.match}`).join('\n')
        expect.fail(`Found ${violations.length} physical border/rounded class(es):\n${formatted}`)
      }
    })
  })

  describe('physical float/clear classes', () => {
    it('should not contain physical float/clear classes', () => {
      const violations: { file: string; match: string; line: number }[] = []
      const regex = /\bfloat-left\b|\bfloat-right\b|\bclear-left\b|\bclear-right\b/g

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          const matches = line.match(regex) || []
          for (const match of matches) {
            violations.push({
              file: path.relative(process.cwd(), file),
              match,
              line: index + 1,
            })
          }
        })
      }

      if (violations.length > 0) {
        const formatted = violations.map((v) => `  ${v.file}:${v.line}: ${v.match}`).join('\n')
        expect.fail(`Found ${violations.length} physical float/clear class(es):\n${formatted}`)
      }
    })
  })

  describe('directional gradients and transforms', () => {
    it('should not contain directional gradients or physical X-axis transforms without ltr:/rtl: variants', () => {
      const violations: { file: string; match: string; line: number }[] = []

      // Scan for bg-gradient-to-r or bg-gradient-to-l
      const gradientRegex = /\bbg-gradient-to-r\b|\bbg-gradient-to-l\b/g

      // Scan for translate-x-* that's not properly handled
      // Exclude: translate-x-0, -translate-x-1, translate-x-1, ltr:/rtl: prefixed
      const transformRegex = /\btranslate-x-[^-][^\s]+/g

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          // Check gradients
          const gradientMatches = line.match(gradientRegex) || []
          for (const match of gradientMatches) {
            // Check if it has ltr:/rtl: prefix
            const hasBidirectionalPrefix =
              line.includes('ltr:bg-gradient-to') || line.includes('rtl:bg-gradient-to')
            if (!hasBidirectionalPrefix) {
              violations.push({
                file: path.relative(process.cwd(), file),
                match,
                line: index + 1,
              })
            }
          }

          // Check transforms - exclude known safe patterns
          const transformMatches = line.match(transformRegex) || []
          for (const match of transformMatches) {
            // Skip known safe transforms
            const safeTransforms = [
              'translate-x-0',
              '-translate-x-1',
              'translate-x-1',
              'translate-x-full',
              'translate-x-[-50',
              'translate-x-[-50%]',
              'translate-x-1/2',
              '-translate-x-1/2',
            ]
            // Check if any part of the match is a safe transform
            const isSafe = safeTransforms.some((safe) => match.includes(safe))
            if (isSafe) continue

            // Skip if already has ltr:/rtl: prefix
            const hasPrefix = line.includes(`ltr:${match}`) || line.includes(`rtl:${match}`)
            if (!hasPrefix) {
              violations.push({
                file: path.relative(process.cwd(), file),
                match: match.trim(),
                line: index + 1,
              })
            }
          }
        })
      }

      if (violations.length > 0) {
        const formatted = violations.map((v) => `  ${v.file}:${v.line}: ${v.match}`).join('\n')
        expect.fail(
          `Found ${violations.length} directional gradient/transform class(es) without ltr:/rtl: prefix:\n${formatted}`,
        )
      }
    })
  })
})
