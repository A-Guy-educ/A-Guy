/**
 * Design Token Audit Script
 *
 * Scans codebase for raw Tailwind values that should use design tokens.
 *
 * Usage:
 *   pnpm tsx scripts/design-tokens/audit.ts src/ui/web
 *   pnpm tsx scripts/design-tokens/audit.ts src/ui/web --verbose
 *   pnpm tsx scripts/design-tokens/audit.ts src/ui/web --fixable
 *
 * Exit codes:
 *   0 - Success (no issues or all fixable)
 *   1 - Unfixable issues found
 */

import { readFile, readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { argv } from 'process'

// Patterns to audit - maps raw values to their design token replacements
const AUDIT_PATTERNS: Array<{
  pattern: RegExp
  token: string
  category: string
  fixable: boolean
}> = [
  // Typography - sizes
  { pattern: /\btext-5xl\b/g, token: 'text-display-lg', category: 'typography', fixable: true },
  { pattern: /\btext-4xl\b/g, token: 'text-display-md', category: 'typography', fixable: true },
  { pattern: /\btext-3xl\b/g, token: 'text-display-sm', category: 'typography', fixable: true },
  { pattern: /\btext-2xl\b/g, token: 'text-display-xl', category: 'typography', fixable: true },
  { pattern: /\btext-xl\b/g, token: 'text-heading-xl', category: 'typography', fixable: true },
  { pattern: /\btext-lg\b/g, token: 'text-body-lg', category: 'typography', fixable: true },
  { pattern: /\btext-base\b/g, token: 'text-body-md', category: 'typography', fixable: true },
  { pattern: /\btext-sm\b/g, token: 'text-body-sm', category: 'typography', fixable: true },
  { pattern: /\btext-xs\b/g, token: 'text-body-xs', category: 'typography', fixable: true },

  // Spacing - padding
  { pattern: /\bp-8\b/g, token: 'p-card-padding-lg', category: 'spacing', fixable: true },
  { pattern: /\bp-6\b/g, token: 'p-card-padding', category: 'spacing', fixable: true },
  { pattern: /\bp-4\b/g, token: 'p-card-padding-sm', category: 'spacing', fixable: true },

  // Spacing - vertical padding
  { pattern: /\bpy-24\b/g, token: 'py-section-xl', category: 'spacing', fixable: true },
  { pattern: /\bpy-16\b/g, token: 'py-section-lg', category: 'spacing', fixable: true },
  { pattern: /\bpy-12\b/g, token: 'py-section-lg', category: 'spacing', fixable: true },
  { pattern: /\bpy-8\b/g, token: 'py-section-md', category: 'spacing', fixable: true },
  { pattern: /\bpy-6\b/g, token: 'py-section-sm', category: 'spacing', fixable: true },
  { pattern: /\bpy-4\b/g, token: 'py-section-xs', category: 'spacing', fixable: true },

  // Gaps
  { pattern: /\bgap-8\b/g, token: 'gap-content-gap-xl', category: 'spacing', fixable: true },
  { pattern: /\bgap-6\b/g, token: 'gap-content-gap-lg', category: 'spacing', fixable: true },
  { pattern: /\bgap-4\b/g, token: 'gap-content-gap', category: 'spacing', fixable: true },
  { pattern: /\bgap-2\b/g, token: 'gap-content-gap-xs', category: 'spacing', fixable: true },

  // Shadows
  { pattern: /\bshadow-xl\b/g, token: 'shadow-card-hover', category: 'shadow', fixable: true },
  { pattern: /\bshadow-lg\b/g, token: 'shadow-card', category: 'shadow', fixable: true },
  { pattern: /\bshadow-md\b/g, token: 'shadow-elevation-3', category: 'shadow', fixable: true },
  { pattern: /\bshadow-sm\b/g, token: 'shadow-elevation-1', category: 'shadow', fixable: true },

  // Durations
  { pattern: /\bduration-500\b/g, token: 'duration-slower', category: 'duration', fixable: true },
  { pattern: /\bduration-300\b/g, token: 'duration-slow', category: 'duration', fixable: true },
  { pattern: /\bduration-200\b/g, token: 'duration-normal', category: 'duration', fixable: true },
  { pattern: /\bduration-150\b/g, token: 'duration-fast', category: 'duration', fixable: true },
  { pattern: /\bduration-100\b/g, token: 'duration-fast', category: 'duration', fixable: true },

  // Border radius - chat bubbles
  {
    pattern: /\brounded-\[30px\]\b/g,
    token: 'rounded-chat-2xl',
    category: 'border-radius',
    fixable: true,
  },
  {
    pattern: /\brounded-\[20px\]\b/g,
    token: 'rounded-chat-lg',
    category: 'border-radius',
    fixable: true,
  },
  {
    pattern: /\brounded-\[24px\]\b/g,
    token: 'rounded-chat-xl',
    category: 'border-radius',
    fixable: true,
  },
  {
    pattern: /\brounded-\[16px\]\b/g,
    token: 'rounded-chat-md',
    category: 'border-radius',
    fixable: true,
  },
  {
    pattern: /\brounded-\[12px\]\b/g,
    token: 'rounded-chat-sm',
    category: 'border-radius',
    fixable: true,
  },

  // Letter spacing
  {
    pattern: /\btracking-\[0\.2em\]\b/g,
    token: 'tracking-lg',
    category: 'letter-spacing',
    fixable: true,
  },
  {
    pattern: /\btracking-\[0\.15em\]\b/g,
    token: 'tracking-md',
    category: 'letter-spacing',
    fixable: true,
  },
  {
    pattern: /\btracking-\[0\.1em\]\b/g,
    token: 'tracking-sm',
    category: 'letter-spacing',
    fixable: true,
  },
  {
    pattern: /\btracking-\[0\.05em\]\b/g,
    token: 'tracking-xs',
    category: 'letter-spacing',
    fixable: true,
  },

  // Max widths
  { pattern: /\bmax-w-\[850px\]\b/g, token: 'max-w-chat', category: 'max-width', fixable: true },
  {
    pattern: /\bmax-w-\[1280px\]\b/g,
    token: 'max-w-content',
    category: 'max-width',
    fixable: true,
  },

  // Non-fixable patterns (need design decisions)
  {
    pattern: /\btext-\[.*?\]\b/g,
    token: 'CUSTOM SIZE NEEDED',
    category: 'non-fixable',
    fixable: false,
  },
  {
    pattern: /\bp-\[.*?\]\b/g,
    token: 'CUSTOM PADDING NEEDED',
    category: 'non-fixable',
    fixable: false,
  },
  {
    pattern: /\bpy-\[.*?\]\b/g,
    token: 'CUSTOM PADDING NEEDED',
    category: 'non-fixable',
    fixable: false,
  },
  {
    pattern: /\bpx-\[.*?\]\b/g,
    token: 'CUSTOM PADDING NEEDED',
    category: 'non-fixable',
    fixable: false,
  },
  {
    pattern: /\bgap-\[.*?\]\b/g,
    token: 'CUSTOM GAP NEEDED',
    category: 'non-fixable',
    fixable: false,
  },
  {
    pattern: /\brounded-\[.*?\]\b/g,
    token: 'CUSTOM RADIUS NEEDED',
    category: 'non-fixable',
    fixable: false,
  },
  {
    pattern: /\bshadow-\[.*?\]\b/g,
    token: 'CUSTOM SHADOW NEEDED',
    category: 'non-fixable',
    fixable: false,
  },
]

interface Issue {
  file: string
  line: number
  raw: string
  token: string
  category: string
  fixable: boolean
}

interface Summary {
  total: number
  fixable: number
  nonFixable: number
  byCategory: Record<string, number>
  byFile: Record<string, Issue[]>
}

async function findIssuesInFile(filePath: string, showFixableOnly: boolean): Promise<Issue[]> {
  const issues: Issue[] = []

  try {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum]

      for (const { pattern, token, category, fixable } of AUDIT_PATTERNS) {
        // Reset regex lastIndex
        pattern.lastIndex = 0

        if (pattern.test(line)) {
          // Find all matches in this line
          const matches = line.match(pattern)
          if (matches) {
            for (const match of matches) {
              if (showFixableOnly && !fixable) continue

              issues.push({
                file: filePath,
                line: lineNum + 1,
                raw: match,
                token,
                category,
                fixable,
              })
            }
          }
        }
      }
    }
  } catch {
    // Skip files that can't be read
  }

  return issues
}

async function auditDirectory(dirPath: string, showFixableOnly: boolean): Promise<Summary> {
  const summary: Summary = {
    total: 0,
    fixable: 0,
    nonFixable: 0,
    byCategory: {},
    byFile: {},
  }

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath)

    for (const entry of entries) {
      const fullPath = join(currentPath, entry)
      const stats = await stat(fullPath)

      if (stats.isDirectory()) {
        if (entry === 'node_modules' || entry === '.next' || entry === '.git') {
          continue
        }
        await walk(fullPath)
      } else if (stats.isFile()) {
        const ext = extname(entry).toLowerCase()
        if (ext === '.tsx' || ext === '.ts') {
          const issues = await findIssuesInFile(fullPath, showFixableOnly)
          if (issues.length > 0) {
            summary.byFile[fullPath] = issues
            summary.total += issues.length

            for (const issue of issues) {
              summary.byCategory[issue.category] = (summary.byCategory[issue.category] || 0) + 1
              if (issue.fixable) {
                summary.fixable++
              } else {
                summary.nonFixable++
              }
            }
          }
        }
      }
    }
  }

  await walk(dirPath)
  return summary
}

async function main() {
  const args = argv.slice(2)

  const verbose = args.includes('--verbose')
  const showFixableOnly = args.includes('--fixable')
  const targetDir = args.find((arg: string) => !arg.startsWith('--')) || 'src/ui/web'

  console.log(`🔍 Auditing design token usage in: ${targetDir}\n`)

  const summary = await auditDirectory(targetDir, showFixableOnly)

  // Print summary by category
  console.log('📊 Summary by Category:')
  console.log('-'.repeat(50))

  const sortedCategories = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])

  for (const [category, count] of sortedCategories) {
    const fixable = category === 'non-fixable' ? '' : ' ✅ fixable'
    console.log(`  ${category}: ${count}${fixable}`)
  }

  console.log('')
  console.log('-'.repeat(50))
  console.log(`Total issues: ${summary.total}`)
  console.log(`  ✅ Fixable: ${summary.fixable}`)
  console.log(`  ❌ Non-fixable: ${summary.nonFixable}`)

  // Print files with issues
  if (verbose && Object.keys(summary.byFile).length > 0) {
    console.log('\n📁 Files with Issues:\n')

    for (const [file, issues] of Object.entries(summary.byFile)) {
      console.log(`${file}:`)
      for (const issue of issues) {
        const fixable = issue.fixable ? '✅' : '❌'
        console.log(`  ${fixable} Line ${issue.line}: \`${issue.raw}\` → \`${issue.token}\``)
      }
      console.log('')
    }
  }

  // Exit with error if non-fixable issues found
  if (summary.nonFixable > 0) {
    console.log(
      `\n⚠️  ${summary.nonFixable} non-fixable issues need design decisions.\n` +
        `   Consider adding new tokens to tailwind.tokens.mjs for common patterns.\n`,
    )
  }

  if (summary.fixable > 0 && !showFixableOnly) {
    console.log(`\n💡 Run \`pnpm design:tokens:codemod\` to auto-fix ${summary.fixable} issues.\n`)
  }

  // Exit code: 1 if non-fixable issues, 0 otherwise
  process.exit(summary.nonFixable > 0 ? 1 : 0)
}

main().catch(console.error)
