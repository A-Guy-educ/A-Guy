// scripts/doc-link-fixer.ts
import fs from 'node:fs'
import path from 'node:path'

type Broken = { file: string; link: string; resolved: string }

const REPO_ROOT = process.cwd()
const REPORT_PATH = path.join(REPO_ROOT, '.ai-docs/reports/doc-link-report.md')
const TRUNCATION_LIMIT = 200

const args = process.argv.slice(2)
const STRICT = args.includes('--strict')

const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g

// File extensions that indicate a code reference
const CODE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.yml',
  '.yaml',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.pdf',
]

// Paths that should be resolved from repo root
const REPO_ROOT_PATTERNS = [
  'src/',
  '/src/',
  '.ai-docs/',
  '/.ai-docs/',
  '.github/',
  '/.github/',
  'package.json',
  'pnpm-lock.yaml',
  'eslint.config.mjs',
]

// Link classification types
type LinkType = 'DOC_LINK' | 'CODE_REF' | 'EXTERNAL_OR_ANCHOR' | 'LOCAL_PATH'

interface ClassifiedLink {
  type: LinkType
  href: string
  target?: string
}

function isExternal(href: string) {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  )
}

function isLocalPath(href: string) {
  return href.startsWith('/Users/') || href.startsWith('C:\\') || href.startsWith('file://')
}

function isCodeReference(href: string, _fromFile: string): boolean {
  // Check if href starts with src/ or /src/
  if (href.startsWith('src/') || href.startsWith('/src/')) {
    return true
  }

  // Check if href ends with a code extension
  const lowerHref = href.toLowerCase()
  for (const ext of CODE_EXTENSIONS) {
    if (lowerHref.endsWith(ext)) {
      return true
    }
  }

  return false
}

function classifyLink(href: string, fromFile: string): ClassifiedLink {
  // EXTERNAL_OR_ANCHOR: http, https, mailto, tel, or fragment-only
  if (isExternal(href)) {
    return { type: 'EXTERNAL_OR_ANCHOR', href }
  }

  if (href.startsWith('#')) {
    return { type: 'EXTERNAL_OR_ANCHOR', href }
  }

  // LOCAL_PATH: absolute local paths
  if (isLocalPath(href)) {
    return { type: 'LOCAL_PATH', href }
  }

  // CODE_REF: code file references
  if (isCodeReference(href, fromFile)) {
    return { type: 'CODE_REF', href }
  }

  // Everything else is potentially a DOC_LINK
  return { type: 'DOC_LINK', href }
}

function normalizeHref(raw: string) {
  let href = raw.trim()
  if (href.startsWith('<') && href.endsWith('>')) href = href.slice(1, -1).trim()
  href = href.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
  return href
}

function splitAnchor(href: string) {
  const idx = href.indexOf('#')
  if (idx === -1) return { p: href, anchor: '' }
  return { p: href.slice(0, idx), anchor: href.slice(idx + 1) }
}

function resolveTarget(fromFile: string, href: string) {
  const { p, anchor } = splitAnchor(href)
  if (!p || p.startsWith('#')) return null

  // Check if this should be resolved from repo root
  const shouldUseRepoRoot = REPO_ROOT_PATTERNS.some((pattern) => href.startsWith(pattern))

  let basePath: string
  if (p.startsWith('/') || shouldUseRepoRoot) {
    // repo-root relative
    basePath = path.join(REPO_ROOT, p.startsWith('/') ? p.slice(1) : p)
  } else {
    // file-relative
    basePath = path.resolve(path.dirname(fromFile), p)
  }

  // Return with anchor for accurate reporting
  return anchor ? `${basePath}#${anchor}` : basePath
}

function fileExists(p: string) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function statIsFile(p: string) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function statIsDir(p: string) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function existsAsMarkdownOrDir(resolved: string): string | null {
  // Always strip anchor before checking file existence
  const { p, anchor } = splitAnchor(resolved)
  const checkPath = p // Always use the path without anchor for existence checks

  // exact file
  if (fileExists(checkPath) && statIsFile(checkPath)) {
    return anchor ? `${checkPath}#${anchor}` : checkPath
  }

  // add .md if missing
  if (!path.extname(checkPath) && fileExists(checkPath + '.md') && statIsFile(checkPath + '.md')) {
    return anchor ? `${checkPath}.md#${anchor}` : checkPath + '.md'
  }

  // directory -> README.md / index.md
  if (fileExists(checkPath) && statIsDir(checkPath)) {
    const readme = path.join(checkPath, 'README.md')
    const index = path.join(checkPath, 'index.md')
    if (fileExists(readme) && statIsFile(readme)) {
      return anchor ? `${readme}#${anchor}` : readme
    }
    if (fileExists(index) && statIsFile(index)) {
      return anchor ? `${index}#${anchor}` : index
    }
  }

  return null
}

function toRelativeHref(fromFile: string, targetAbs: string, originalHref: string) {
  // Split anchor from targetAbs to avoid passing '#' to path.relative()
  const { p: targetPathAbs, anchor: targetAnchor } = splitAnchor(targetAbs)
  const { anchor } = splitAnchor(originalHref)

  // Compute relative path from the path portion only (no anchor)
  let rel = path.relative(path.dirname(fromFile), targetPathAbs).replaceAll(path.sep, '/')
  if (!rel.startsWith('.')) rel = './' + rel

  // Use anchor from targetAbs if present, otherwise from originalHref
  const finalAnchor = targetAnchor || anchor
  return finalAnchor ? `${rel}#${finalAnchor}` : rel
}

function getAllMarkdownFiles(dir: string) {
  const out: string[] = []
  const stack = [dir]

  while (stack.length) {
    const cur = stack.pop()!
    const entries = fs.readdirSync(cur, { withFileTypes: true })

    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(e.name))
          continue
        stack.push(path.join(cur, e.name))
        continue
      }
      if (e.isFile() && e.name.endsWith('.md')) out.push(path.join(cur, e.name))
    }
  }

  return out
}

function ensureReportDir() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
}

function deleteReportIfExists() {
  try {
    if (fs.existsSync(REPORT_PATH)) fs.unlinkSync(REPORT_PATH)
  } catch {
    // ignore
  }
}

interface ReportData {
  brokenDocLinks: Broken[]
  missingCodeRef: Broken[]
  localPathLinks: Broken[]
}

function writeFailureReport(data: ReportData) {
  ensureReportDir()

  const lines: string[] = []
  lines.push(`# Doc Link Fixer - Failure Report`)
  lines.push(``)
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(``)

  // Summary counts
  lines.push(`## Summary`)
  lines.push(``)
  lines.push(
    `- **Broken Doc Links**: ${data.brokenDocLinks.length} (these will cause failure in strict mode)`,
  )
  lines.push(`- **Missing Code References**: ${data.missingCodeRef.length} (warning only)`)
  lines.push(`- **Local Path Links**: ${data.localPathLinks.length} (warning only)`)
  lines.push(``)

  const totalBroken = data.brokenDocLinks.length
  const isTruncated = totalBroken > TRUNCATION_LIMIT
  const displayBroken = isTruncated
    ? data.brokenDocLinks.slice(0, TRUNCATION_LIMIT)
    : data.brokenDocLinks

  if (isTruncated) {
    lines.push(
      `(truncated: showing first ${TRUNCATION_LIMIT} of ${totalBroken} total broken doc links)`,
    )
    lines.push(``)
  }

  // Only show "Top source files" for broken doc links
  if (displayBroken.length > 0) {
    // Group by source file for easier navigation
    const byFile = new Map<string, Broken[]>()
    for (const b of displayBroken) {
      if (!byFile.has(b.file)) byFile.set(b.file, [])
      byFile.get(b.file)!.push(b)
    }

    // Sort by count descending, then alphabetically
    const sortedFiles = Array.from(byFile.entries()).sort((a, b) => {
      const countDiff = b[1].length - a[1].length
      if (countDiff !== 0) return countDiff
      return a[0].localeCompare(b[0])
    })

    lines.push(`## By Source File`)
    lines.push(``)
    for (const [file, links] of sortedFiles) {
      lines.push(`### ${file} (${links.length} broken links)`)
      lines.push(``)
      for (const b of links) {
        lines.push(`- \`${b.link}\` → \`${b.resolved}\``)
      }
      lines.push(``)
    }
  }

  // Warnings section
  if (data.missingCodeRef.length > 0 || data.localPathLinks.length > 0) {
    lines.push(`## Warnings (non-blocking)`)
    lines.push(``)

    if (data.missingCodeRef.length > 0) {
      lines.push(`### Missing Code References`)
      lines.push(``)
      for (const ref of data.missingCodeRef.slice(0, 50)) {
        lines.push(`- \`${ref.link}\` in ${ref.file}`)
      }
      lines.push(``)
    }

    if (data.localPathLinks.length > 0) {
      lines.push(`### Local Path Links`)
      lines.push(``)
      for (const ref of data.localPathLinks.slice(0, 50)) {
        lines.push(`- \`${ref.link}\` in ${ref.file}`)
      }
      lines.push(``)
    }
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8')
}

function scanAndMaybeFix({ applyFixes }: { applyFixes: boolean }) {
  const mdFiles = getAllMarkdownFiles(REPO_ROOT)

  let changedFiles = 0
  const brokenDocLinks: Broken[] = []
  const missingCodeRef: Broken[] = []
  const localPathLinks: Broken[] = []

  for (const file of mdFiles) {
    const original = fs.readFileSync(file, 'utf8')
    let updated = original
    let touched = false

    updated = updated.replace(MD_LINK_RE, (full, text, hrefRaw) => {
      const href0 = normalizeHref(hrefRaw)

      // Classify the link
      const classified = classifyLink(href0, file)

      // Handle based on classification
      switch (classified.type) {
        case 'EXTERNAL_OR_ANCHOR':
          // Keep external links and anchors unchanged
          return full

        case 'CODE_REF':
          // For code references, check if target exists (for warning)
          const codeTarget = resolveTarget(file, href0)
          if (codeTarget && !fileExists(codeTarget.split('#')[0])) {
            missingCodeRef.push({
              file: path.relative(REPO_ROOT, file),
              link: href0,
              resolved: path.relative(REPO_ROOT, codeTarget),
            })
          }
          // Never modify code references
          return full

        case 'LOCAL_PATH':
          // Report local paths but never modify
          localPathLinks.push({
            file: path.relative(REPO_ROOT, file),
            link: href0,
            resolved: href0,
          })
          return full

        case 'DOC_LINK':
        default:
          // For doc links, try to resolve and fix
          break
      }

      // Keep anchors-only untouched
      if (href0.startsWith('#')) return `[${text}](${href0})`

      // Resolve target directly (no rewrites)
      const target = resolveTarget(file, href0)
      if (!target) return `[${text}](${href0})`

      const existing = existsAsMarkdownOrDir(target)
      if (existing) {
        // Canonicalize to relative href (adds .md, README, etc.)
        const newHref = toRelativeHref(file, existing, href0)
        if (applyFixes && newHref !== href0) {
          touched = true
          return `[${text}](${newHref})`
        }
        return `[${text}](${href0})`
      }

      // Still broken - report it as broken doc link
      brokenDocLinks.push({
        file: path.relative(REPO_ROOT, file),
        link: href0,
        resolved: path.relative(REPO_ROOT, target),
      })

      return `[${text}](${href0})`
    })

    if (applyFixes && touched && updated !== original) {
      fs.writeFileSync(file, updated, 'utf8')
      changedFiles++
    }
  }

  return { changedFiles, brokenDocLinks, missingCodeRef, localPathLinks }
}

function main() {
  // PASS 1: try to fix what is safe
  const pass1 = scanAndMaybeFix({ applyFixes: true })

  // PASS 2: rescan after fixes, report only if still broken
  const pass2 = scanAndMaybeFix({ applyFixes: false })

  // Check exit conditions
  const hasBrokenDocLinks = pass2.brokenDocLinks.length > 0
  const hasLocalPathLinks = pass2.localPathLinks.length > 0

  if (!hasBrokenDocLinks && !hasLocalPathLinks) {
    deleteReportIfExists()
    console.log(
      `Doc link fixer: OK (changed files: ${pass1.changedFiles}, warnings: ${pass2.missingCodeRef.length})`,
    )
    process.exit(0)
  }

  // Failure: write report
  writeFailureReport({
    brokenDocLinks: pass2.brokenDocLinks,
    missingCodeRef: pass2.missingCodeRef,
    localPathLinks: pass2.localPathLinks,
  })

  console.error(
    `Broken doc links: ${pass2.brokenDocLinks.length}. Local path links: ${pass2.localPathLinks.length}. Missing code refs: ${pass2.missingCodeRef.length}. Report: ${path.relative(REPO_ROOT, REPORT_PATH)}.`,
  )

  // Strict mode or has broken doc links: fail
  if (STRICT || hasBrokenDocLinks) {
    process.exit(1)
  }

  // Non-strict with only warnings: succeed
  process.exit(0)
}

main()
