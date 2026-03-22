/**
 * Design Token Codemod
 *
 * Automatically replaces raw Tailwind values with design tokens.
 *
 * Usage (directory mode):
 *   pnpm tsx scripts/design-tokens/codemod.ts src/ui/web
 *   pnpm tsx scripts/design-tokens/codemod.ts src/ui/web --dry-run
 *   pnpm tsx scripts/design-tokens/codemod.ts src/ui/web --verbose
 *
 * Usage (file mode - for lint-staged):
 *   pnpm tsx scripts/design-tokens/codemod.ts file1.tsx file2.tsx
 *
 * Patterns replaced:
 * - text-xl → text-heading-xl
 * - text-lg → text-body-lg
 * - p-6 → p-card-padding
 * - py-8 → py-section-md
 * - gap-4 → gap-content-gap
 * - shadow-lg → shadow-card
 * - duration-150 → duration-fast
 * - rounded-[20px] → rounded-chat-lg
 * - rounded-[30px] → rounded-chat-2xl
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { argv } from 'process'

// Design token replacements - order matters (longer matches first)
const REPLACEMENTS: Array<[pattern: RegExp, replacement: string]> = [
  // Typography - sizes (exact matches only to avoid breaking class names)
  [/\btext-5xl\b/g, 'text-display-lg'],
  [/\btext-4xl\b/g, 'text-display-md'],
  [/\btext-3xl\b/g, 'text-display-sm'],
  [/\btext-2xl\b/g, 'text-display-xl'],
  [/\btext-xl\b/g, 'text-heading-xl'],
  [/\btext-lg\b/g, 'text-body-lg'],
  [/\btext-base\b/g, 'text-body-md'],
  [/\btext-sm\b/g, 'text-body-sm'],
  [/\btext-xs\b/g, 'text-body-xs'],

  // Spacing - padding
  [/\bp-8\b/g, 'p-card-padding-lg'],
  [/\bp-6\b/g, 'p-card-padding'],
  [/\bp-4\b/g, 'p-card-padding-sm'],

  // Spacing - vertical padding
  [/\bpy-24\b/g, 'py-section-xl'],
  [/\bpy-16\b/g, 'py-section-lg'],
  [/\bpy-12\b/g, 'py-section-lg'],
  [/\bpy-8\b/g, 'py-section-md'],
  [/\bpy-6\b/g, 'py-section-sm'],
  [/\bpy-4\b/g, 'py-section-xs'],

  // Gaps
  [/\bgap-8\b/g, 'gap-content-gap-xl'],
  [/\bgap-6\b/g, 'gap-content-gap-lg'],
  [/\bgap-4\b/g, 'gap-content-gap'],
  [/\bgap-2\b/g, 'gap-content-gap-xs'],

  // Shadows
  [/\bshadow-xl\b/g, 'shadow-card-hover'],
  [/\bshadow-lg\b/g, 'shadow-card'],
  [/\bshadow-md\b/g, 'shadow-elevation-3'],
  [/\bshadow-sm\b/g, 'shadow-elevation-1'],

  // Durations
  [/\bduration-500\b/g, 'duration-slower'],
  [/\bduration-300\b/g, 'duration-slow'],
  [/\bduration-200\b/g, 'duration-normal'],
  [/\bduration-150\b/g, 'duration-fast'],
  [/\bduration-100\b/g, 'duration-fast'],

  // Border radius - chat bubbles (common patterns)
  [/\brounded-\[30px\]\b/g, 'rounded-chat-2xl'],
  [/\brounded-\[20px\]\b/g, 'rounded-chat-lg'],
  [/\brounded-\[24px\]\b/g, 'rounded-chat-xl'],
  [/\brounded-\[16px\]\b/g, 'rounded-chat-md'],
  [/\brounded-\[12px\]\b/g, 'rounded-chat-sm'],

  // Letter spacing (tracking)
  [/\btracking-\[0\.2em\]\b/g, 'tracking-lg'],
  [/\btracking-\[0\.15em\]\b/g, 'tracking-md'],
  [/\btracking-\[0\.1em\]\b/g, 'tracking-sm'],
  [/\btracking-\[0\.05em\]\b/g, 'tracking-xs'],

  // Max widths
  [/\bmax-w-\[850px\]\b/g, 'max-w-chat'],
  [/\bmax-w-\[1280px\]\b/g, 'max-w-content'],
]

interface Options {
  dryRun: boolean
  verbose: boolean
  targetDir: string
  files: string[]
}

async function processFile(filePath: string, options: Options): Promise<number> {
  const content = await readFile(filePath, 'utf-8')
  let newContent = content
  let changeCount = 0

  for (const [pattern, replacement] of REPLACEMENTS) {
    const matches = content.match(pattern)
    if (matches) {
      changeCount += matches.length
      newContent = newContent.replace(pattern, replacement)
    }
  }

  if (changeCount > 0 && !options.dryRun) {
    await writeFile(filePath, newContent, 'utf-8')
  }

  return changeCount
}

async function processDirectory(
  dirPath: string,
  options: Options,
): Promise<{ files: number; changes: number }> {
  let totalChanges = 0
  let filesProcessed = 0

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath)

    for (const entry of entries) {
      const fullPath = join(currentPath, entry)
      const stats = await stat(fullPath)

      if (stats.isDirectory()) {
        // Skip node_modules and .next
        if (entry === 'node_modules' || entry === '.next' || entry === '.git') {
          continue
        }
        await walk(fullPath)
      } else if (stats.isFile()) {
        const ext = extname(entry).toLowerCase()
        if (ext === '.tsx' || ext === '.ts') {
          filesProcessed++
          const changes = await processFile(fullPath, options)
          if (changes > 0) {
            totalChanges += changes
            if (options.verbose) {
              console.log(`  ${fullPath}: ${changes} change(s)`)
            }
          }
        }
      }
    }
  }

  await walk(dirPath)
  return { files: filesProcessed, changes: totalChanges }
}

async function main() {
  const args = argv.slice(2)

  const dryRun = args.includes('--dry-run')
  const verbose = args.includes('--verbose')

  // Separate file arguments from options
  const fileArgs = args.filter((arg: string) => !arg.startsWith('--'))
  const options = args.filter((arg: string) => arg.startsWith('--'))

  // If no positional args, nothing to do
  if (fileArgs.length === 0) {
    console.log('No files or directory specified')
    console.log('Usage:')
    console.log('  pnpm tsx scripts/design-tokens/codemod.ts file1.tsx file2.tsx')
    console.log('  pnpm tsx scripts/design-tokens/codemod.ts src/ui/web')
    return
  }

  let totalFiles = 0
  let totalChanges = 0

  if (dryRun) {
    console.log('🔍 DRY RUN - No files will be modified\n')
  }

  // Determine if first arg is a directory or file(s)
  const firstArg = fileArgs[0]
  const stats = await stat(firstArg).catch(() => null)

  if (stats && stats.isDirectory()) {
    // Directory mode - process entire directory
    console.log(`📁 Processing directory: ${firstArg}\n`)
    const result = await processDirectory(firstArg, {
      dryRun,
      verbose,
      targetDir: firstArg,
      files: [],
    })
    totalFiles = result.files
    totalChanges = result.changes
  } else {
    // File mode - process individual files (for lint-staged)
    console.log(`📄 Processing ${fileArgs.length} file(s)\n`)
    for (const filePath of fileArgs) {
      const changes = await processFile(filePath, {
        dryRun,
        verbose,
        targetDir: '',
        files: fileArgs,
      })
      if (changes > 0) {
        totalChanges += changes
        if (verbose) {
          console.log(`  ${filePath}: ${changes} change(s)`)
        }
      }
      totalFiles++
    }
  }

  console.log(`\n✅ Complete!`)
  console.log(`   Files scanned: ${totalFiles}`)
  console.log(`   Total replacements: ${totalChanges}`)

  if (dryRun) {
    console.log(`\n   Run without --dry-run to apply changes`)
  }
}

main().catch(console.error)
