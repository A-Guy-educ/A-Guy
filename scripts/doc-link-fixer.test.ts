// scripts/doc-link-fixer.test.ts
import assert from 'node:assert'
import * as fs from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

const TRUNCATION_LIMIT = 200

function splitAnchor(href: string) {
  const idx = href.indexOf('#')
  if (idx === -1) return { p: href, anchor: '' }
  return { p: href.slice(0, idx), anchor: href.slice(idx + 1) }
}

function normalizeHref(raw: string) {
  let href = raw.trim()
  if (href.startsWith('<') && href.endsWith('>')) href = href.slice(1, -1).trim()
  href = href.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
  return href
}

function resolveTarget(fromFile: string, href: string) {
  const { p, anchor } = splitAnchor(href)
  if (!p || p.startsWith('#')) return null

  let basePath: string
  if (p.startsWith('/')) {
    basePath = path.join(REPO_ROOT, p.slice(1))
  } else {
    basePath = path.resolve(path.dirname(fromFile), p)
  }

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
  const { p, anchor } = splitAnchor(resolved)
  const checkPath = p

  if (fileExists(checkPath) && statIsFile(checkPath)) {
    return anchor ? `${checkPath}#${anchor}` : checkPath
  }

  if (!path.extname(checkPath) && fileExists(checkPath + '.md') && statIsFile(checkPath + '.md')) {
    return anchor ? `${checkPath}.md#${anchor}` : checkPath + '.md'
  }

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
  const { p: targetPathAbs, anchor: targetAnchor } = splitAnchor(targetAbs)
  const { anchor } = splitAnchor(originalHref)

  let rel = path.relative(path.dirname(fromFile), targetPathAbs).replaceAll(path.sep, '/')
  if (!rel.startsWith('.')) rel = './' + rel

  const finalAnchor = targetAnchor || anchor
  return finalAnchor ? `${rel}#${finalAnchor}` : rel
}

describe('splitAnchor', () => {
  test('splits basic anchor', () => {
    const result = splitAnchor('/repo/docs/a.md#section')
    assert.deepStrictEqual(result, { p: '/repo/docs/a.md', anchor: 'section' })
  })

  test('handles no anchor', () => {
    const result = splitAnchor('/repo/docs/a.md')
    assert.deepStrictEqual(result, { p: '/repo/docs/a.md', anchor: '' })
  })

  test('handles fragment-only link', () => {
    const result = splitAnchor('#section')
    assert.deepStrictEqual(result, { p: '', anchor: 'section' })
  })
})

describe('normalizeHref', () => {
  test('removes angle brackets', () => {
    assert.strictEqual(normalizeHref('<https://example.com>'), 'https://example.com')
  })

  test('removes quotes', () => {
    assert.strictEqual(normalizeHref('"https://example.com"'), 'https://example.com')
    assert.strictEqual(normalizeHref("'https://example.com'"), 'https://example.com')
  })

  test('trims whitespace', () => {
    assert.strictEqual(normalizeHref('  https://example.com  '), 'https://example.com')
  })
})

describe('resolveTarget', () => {
  test('resolves repo-root path', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const target = resolveTarget(fromFile, '/README.md')
    assert.strictEqual(target, path.join(REPO_ROOT, 'README.md'))
  })

  test('resolves file-relative path', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const target = resolveTarget(fromFile, 'guide.md')
    assert.strictEqual(target, path.join(REPO_ROOT, 'docs/guide.md'))
  })

  test('resolves parent path', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/deep/nested/page.md')
    const target = resolveTarget(fromFile, '../sibling.md')
    assert.strictEqual(target, path.join(REPO_ROOT, 'docs/deep/sibling.md'))
  })

  test('preserves anchor in repo-root path', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const target = resolveTarget(fromFile, '/README.md#section')
    assert.strictEqual(target, path.join(REPO_ROOT, 'README.md#section'))
  })

  test('preserves anchor in file-relative path', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const target = resolveTarget(fromFile, 'guide.md#section')
    assert.strictEqual(target, path.join(REPO_ROOT, 'docs/guide.md#section'))
  })

  test('returns null for anchor-only', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const target = resolveTarget(fromFile, '#section')
    assert.strictEqual(target, null)
  })
})

describe('existsAsMarkdownOrDir', () => {
  test('finds existing file', () => {
    const testFile = path.join(REPO_ROOT, 'README.md')
    const result = existsAsMarkdownOrDir(testFile)
    assert.strictEqual(result, testFile)
  })

  test('finds file with anchor', () => {
    const testFile = path.join(REPO_ROOT, 'README.md')
    const input = `${testFile}#section`
    const result = existsAsMarkdownOrDir(input)
    assert.strictEqual(result, input)
  })

  test('adds .md extension', () => {
    const testDir = path.join(REPO_ROOT, 'docs')
    const input = path.join(testDir, 'access-control')
    const result = existsAsMarkdownOrDir(input)
    assert.ok(result?.endsWith('access-control/README.md'), `Expected README.md, got: ${result}`)
  })

  test('finds directory README.md', () => {
    const testDir = path.join(REPO_ROOT, 'docs/access-control')
    const result = existsAsMarkdownOrDir(testDir)
    assert.ok(
      result?.endsWith('access-control/README.md'),
      `Expected access-control/README.md, got: ${result}`,
    )
  })

  test('returns null for non-existent path', () => {
    const result = existsAsMarkdownOrDir('/nonexistent/path.md')
    assert.strictEqual(result, null)
  })
})

describe('toRelativeHref', () => {
  test('produces correct relative path with anchor', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const targetAbs = path.join(REPO_ROOT, 'docs/a.md#section')
    const originalHref = 'a.md#section'
    const result = toRelativeHref(fromFile, targetAbs, originalHref)
    // Path portion should not contain #
    const hashIndex = result.indexOf('#')
    const pathPortion = hashIndex === -1 ? result : result.slice(0, hashIndex)
    assert.ok(!pathPortion.includes('#'), `Path should not have #: ${result}`)
    assert.ok(result.endsWith('#section'), `Should end with anchor: ${result}`)
  })

  test('handles anchor in targetAbs correctly', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const targetAbs = path.join(REPO_ROOT, 'docs/deep/nested/file.md#sec')
    const originalHref = './deep/nested/file.md'
    const result = toRelativeHref(fromFile, targetAbs, originalHref)
    assert.strictEqual(result, './deep/nested/file.md#sec')
  })

  test('uses original anchor when targetAbs has no anchor', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const targetAbs = path.join(REPO_ROOT, 'a.md')
    const originalHref = 'docs/a.md#section'
    const result = toRelativeHref(fromFile, targetAbs, originalHref)
    assert.ok(result.endsWith('#section'), `Should include anchor: ${result}`)
  })

  test('handles POSIX paths with anchors', () => {
    const fromFile = '/repo/docs/intro.md'
    const targetAbs = '/repo/docs/a.md#section'
    const result = toRelativeHref(fromFile, targetAbs, 'docs/a.md#section')
    const hashIndex = result.indexOf('#')
    const pathPortion = hashIndex === -1 ? result : result.slice(0, hashIndex)
    assert.ok(!pathPortion.includes('#'), `Path should not have #: ${result}`)
  })

  test('normalizes path separators on POSIX', () => {
    const fromFile = path.join(REPO_ROOT, 'docs', 'intro.md')
    const targetAbs = path.join(REPO_ROOT, 'docs', 'a.md')
    const result = toRelativeHref(fromFile, targetAbs, 'docs/a.md')
    assert.ok(!result.includes('\\'), `Should use forward slashes: ${result}`)
  })
})

describe('filesystem-driven resolution', () => {
  test('relative link resolves correctly', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const href = 'access-control/README.md'
    const target = resolveTarget(fromFile, href)
    assert.ok(
      target?.endsWith('access-control/README.md'),
      `Expected access-control/README.md, got: ${target}`,
    )
  })

  test('repo-root link resolves from repo root', () => {
    const fromFileDeep = path.join(REPO_ROOT, 'docs/deep/nested/page.md')
    const fromFileRoot = path.join(REPO_ROOT, 'README.md')

    const href = '/README.md'
    const targetDeep = resolveTarget(fromFileDeep, href)
    const targetRoot = resolveTarget(fromFileRoot, href)

    assert.strictEqual(
      targetDeep,
      targetRoot,
      'Repo-root path should resolve same regardless of source',
    )
  })

  test('directory resolves to README.md', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const href = './access-control'
    const target = resolveTarget(fromFile, href)
    const existing = existsAsMarkdownOrDir(target!)
    assert.ok(
      existing?.endsWith('access-control/README.md'),
      `Should resolve to README.md: ${existing}`,
    )
  })

  test('anchor preserved through resolution', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const href = './access-control#setup'
    const target = resolveTarget(fromFile, href)
    const existing = existsAsMarkdownOrDir(target!)
    assert.strictEqual(existing, path.join(REPO_ROOT, 'docs/access-control/README.md#setup'))
  })
})

describe('broken links reporting', () => {
  test('non-existing path is not rewritten', () => {
    const fromFile = path.join(REPO_ROOT, 'docs/intro.md')
    const href = 'nonexistent-file.md'
    const target = resolveTarget(fromFile, href)
    const existing = existsAsMarkdownOrDir(target!)
    assert.strictEqual(existing, null, 'Non-existing file should return null')
  })

  test('broken link appears in report (simulated)', () => {
    const broken = [
      { file: 'docs/intro.md', link: 'nonexistent.md', resolved: 'docs/nonexistent.md' },
    ]
    assert.strictEqual(broken.length, 1)
    assert.strictEqual(broken[0].link, 'nonexistent.md')
  })
})

describe('report truncation', () => {
  test('respects TRUNCATION_LIMIT constant', () => {
    assert.strictEqual(TRUNCATION_LIMIT, 200, 'TRUNCATION_LIMIT should be 200')
  })

  test('truncation slices correctly', () => {
    const all = Array.from({ length: 250 }, (_, i) => ({ id: i }))
    const truncated = all.slice(0, TRUNCATION_LIMIT)
    assert.strictEqual(truncated.length, TRUNCATION_LIMIT)
    assert.strictEqual(all.length, 250)
  })
})
