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

function isExternal(href: string) {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  )
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

  let basePath: string
  if (p.startsWith('/')) {
    // repo-root relative
    basePath = path.join(REPO_ROOT, p.slice(1))
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

function writeFailureReport(broken: Broken[]) {
  ensureReportDir()

  const lines: string[] = []
  lines.push(`# Doc Link Fixer - Failure Report`)
  lines.push(``)
  lines.push(`Generated: ${new Date().toISOString()}`)

  const isTruncated = broken.length > TRUNCATION_LIMIT
  const displayBroken = isTruncated ? broken.slice(0, TRUNCATION_LIMIT) : broken

  lines.push(`Broken internal links remaining: **${broken.length}**`)
  if (isTruncated) {
    lines.push(`(truncated: showing first ${TRUNCATION_LIMIT} of ${broken.length} total)`)
  }
  lines.push(``)

  // Group by source file for easier navigation
  const byFile = new Map<string, Broken[]>()
  for (const b of displayBroken) {
    if (!byFile.has(b.file)) byFile.set(b.file, [])
    byFile.get(b.file)!.push(b)
  }

  lines.push(`## By Source File`)
  lines.push(``)
  for (const [file, links] of byFile) {
    lines.push(`### ${file} (${links.length} broken links)`)
    lines.push(``)
    for (const b of links) {
      lines.push(`- \`${b.link}\` → \`${b.resolved}\``)
    }
    lines.push(``)
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8')
}

function scanAndMaybeFix({ applyFixes }: { applyFixes: boolean }) {
  const mdFiles = getAllMarkdownFiles(REPO_ROOT)

  let changedFiles = 0
  const broken: Broken[] = []

  for (const file of mdFiles) {
    const original = fs.readFileSync(file, 'utf8')
    let updated = original
    let touched = false

    updated = updated.replace(MD_LINK_RE, (full, text, hrefRaw) => {
      const href0 = normalizeHref(hrefRaw)
      if (isExternal(href0)) return full

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

      // Still broken - report it
      broken.push({
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

  return { changedFiles, broken }
}

function main() {
  // PASS 1: try to fix what is safe
  const pass1 = scanAndMaybeFix({ applyFixes: true })

  // PASS 2: rescan after fixes, report only if still broken
  const pass2 = scanAndMaybeFix({ applyFixes: false })

  if (pass2.broken.length === 0) {
    deleteReportIfExists()
    console.log(`Doc link fixer: OK (changed files: ${pass1.changedFiles})`)
    process.exit(0)
  }

  // Failure: write report (failure-only)
  writeFailureReport(pass2.broken)
  console.error(
    `Broken links remaining: ${pass2.broken.length}. Report: ${path.relative(REPO_ROOT, REPORT_PATH)}.`,
  )

  // Strict mode: fail; otherwise succeed (useful for scheduled runs)
  if (STRICT) process.exit(1)
  process.exit(0)
}

main()
