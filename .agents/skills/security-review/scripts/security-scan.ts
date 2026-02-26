#!/usr/bin/env npx tsx
/**
 * Security Scan Script
 *
 * @fileType utility
 * @domain security, automation
 * @ai-summary Scan codebase for common security vulnerabilities
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join, extname } from 'path'
import { parseArgs } from 'util'
import { execSync } from 'child_process'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Severity = 'CRITICAL' | 'WARNING' | 'INFO'

interface SecurityPattern {
  regex: RegExp
  severity: Severity
  category: string
  message: string
  suggestion?: string
  excludeTest?: boolean
}

interface Finding {
  severity: Severity
  category: string
  message: string
  file: string
  line?: number
  suggestion?: string
}

interface SecurityReport {
  timestamp: string
  status: 'passed' | 'failed'
  findings: Finding[]
  summary: {
    critical: number
    warning: number
    info: number
    total: number
  }
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
}

function log(message: string, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`)
}

function scanDirectory(dir: string, extensions: string[]): string[] {
  const files: string[] = []

  if (!existsSync(dir)) return files

  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    // Skip node_modules, .git, etc.
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...scanDirectory(fullPath, extensions))
    } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

function readFileSafely(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

// ─────────────────────────────────────────────
// Security Checks
// ─────────────────────────────────────────────

const SECURITY_PATTERNS = {
  // Hardcoded secrets
  hardcodedApiKey: {
    regex:
      /(?:api[_-]?key|apikey|secret|token|password|pwd|passwd)\s*[=:]\s*['"`][a-zA-Z0-9_-]{20,}['"`]/gi,
    severity: 'CRITICAL' as Severity,
    category: 'Hardcoded Secrets',
    message: 'Potential hardcoded API key or secret',
    suggestion: 'Move to environment variable: process.env.VARIABLE_NAME',
  },
  // More secret patterns
  awsKeys: {
    regex: /(?:AKIA|ABIA|ACCA)[A-Z0-9]{16}/g,
    severity: 'CRITICAL' as Severity,
    category: 'Hardcoded Secrets',
    message: 'Potential AWS access key',
    suggestion: 'Use IAM roles or environment variables',
  },
  // Console.log in production
  consoleLog: {
    regex: /console\.(log|debug|info)\s*\(/g,
    severity: 'INFO' as Severity,
    category: 'Console Logging',
    message: 'Console statement found - may leak in production',
    suggestion: 'Use proper logger (pino) or remove in production',
    excludeTest: true,
  },
  // localStorage for tokens
  localStorageToken: {
    regex: /localStorage\.setItem\s*\(\s*['"`]?(?:token|auth|jwt)/gi,
    severity: 'CRITICAL' as Severity,
    category: 'Insecure Storage',
    message: 'Storing tokens in localStorage - vulnerable to XSS',
    suggestion: 'Use httpOnly cookies instead',
  },
  // SQL injection risk
  sqlTemplate: {
    regex: /`\s*SELECT.*\$\{/g,
    severity: 'CRITICAL' as Severity,
    category: 'SQL Injection',
    message: 'Potential SQL injection - template literal with variable',
    suggestion: 'Use parameterized queries',
  },
  // eval usage
  evalUsage: {
    regex: /\beval\s*\(/g,
    severity: 'CRITICAL' as Severity,
    category: 'Code Injection',
    message: 'eval() usage - security risk',
    suggestion: 'Avoid eval(), use JSON.parse() for data',
  },
  // Hardcoded URL in fetch
  hardcodedUrl: {
    regex: /fetch\s*\(\s*['"`]http:/gi,
    severity: 'WARNING' as Severity,
    category: 'Hardcoded URLs',
    message: 'Hardcoded HTTP URL - should use HTTPS',
    suggestion: 'Use HTTPS or environment variables for URLs',
  },
  // process.env without check
  envWithoutCheck: {
    regex: /process\.env\.[A-Z_]+\s*(?![?.])/g,
    severity: 'INFO' as Severity,
    category: 'Environment Variables',
    message: 'Using process.env without null check',
    suggestion: 'Add validation: if (!process.env.VAR) throw new Error()',
  },
}

function checkFile(filePath: string, patterns: Record<string, SecurityPattern>): Finding[] {
  const findings: Finding[] = []
  const content = readFileSafely(filePath)

  if (!content) return findings

  const isTestFile =
    filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')

  for (const [, pattern] of Object.entries(patterns)) {
    // Skip console.log checks in test files
    if (isTestFile && pattern.excludeTest) continue

    const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
    let match

    while ((match = regex.exec(content)) !== null) {
      // Find line number
      const lineNumber = content.slice(0, match.index).split('\n').length

      findings.push({
        severity: pattern.severity,
        category: pattern.category,
        message: pattern.message,
        file: filePath.replace(process.cwd() + '/', ''),
        line: lineNumber,
        suggestion: pattern.suggestion,
      })
    }
  }

  return findings
}

// ─────────────────────────────────────────────
// Collection-specific Checks
// ─────────────────────────────────────────────

function checkCollections(collectionsDir: string): Finding[] {
  const findings: Finding[] = []

  if (!existsSync(collectionsDir)) return findings

  const collectionFiles = scanDirectory(collectionsDir, ['.ts'])

  for (const file of collectionFiles) {
    const content = readFileSafely(file)
    if (!content) continue

    // Check for missing access control
    const hasAccessProperty = content.includes('access:') || content.includes('access =')

    // Basic collection config detection
    const isCollectionConfig = content.includes('CollectionConfig') && content.includes('slug:')

    if (isCollectionConfig && !hasAccessProperty) {
      findings.push({
        severity: 'CRITICAL',
        category: 'Missing Access Control',
        message: 'Collection may be missing access control',
        file: file.replace(process.cwd() + '/', ''),
        suggestion: 'Add access: { read: ..., create: ..., update: ..., delete: ... }',
      })
    }

    // Check for overrideAccess without user
    if (content.includes('overrideAccess: false') && !content.includes('user:')) {
      findings.push({
        severity: 'WARNING',
        category: 'Access Control',
        message: 'overrideAccess: false used without user context',
        file: file.replace(process.cwd() + '/', ''),
        suggestion: 'Pass user to Local API for proper access control',
      })
    }
  }

  return findings
}

// ─────────────────────────────────────────────
// Report Generation
// ─────────────────────────────────────────────

function generateMarkdownReport(report: SecurityReport): string {
  const { timestamp, status, findings, summary } = report

  let md = `# Security Scan Report\n\n`
  md += `**Date**: ${timestamp}\n`
  md += `**Status**: ${status === 'passed' ? '✅ PASSED' : '❌ FAILED'}\n\n`
  md += `## Summary\n\n`
  md += `- 🔴 Critical: ${summary.critical}\n`
  md += `- 🟡 Warning: ${summary.warning}\n`
  md += `- 🔵 Info: ${summary.info}\n`
  md += `- 📊 Total: ${summary.total}\n\n`
  md += `---\n\n`

  if (findings.length === 0) {
    md += `## ✅ No security issues found!\n\n`
    return md
  }

  for (const finding of findings) {
    const icon =
      finding.severity === 'CRITICAL' ? '🔴' : finding.severity === 'WARNING' ? '🟡' : '🔵'
    md += `## ${icon} ${finding.severity}: ${finding.category}\n\n`
    md += `**File**: ${finding.file}${finding.line ? `:${finding.line}` : ''}\n\n`
    md += `**Issue**: ${finding.message}\n\n`
    if (finding.suggestion) {
      md += `**Fix**: ${finding.suggestion}\n\n`
    }
    md += `---\n\n`
  }

  md += `## Recommendations\n\n`
  md += `1. Review all CRITICAL findings immediately\n`
  md += `2. Address WARNING items in next sprint\n`
  md += `3. Consider INFO items for future improvements\n`

  return md
}

function generateJSONReport(report: SecurityReport): string {
  return JSON.stringify(report, null, 2)
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  // Parse CLI arguments
  const { values } = parseArgs({
    options: {
      path: { type: 'string', default: 'src' },
      collections: { type: 'string', default: '' },
      'skip-audit': { type: 'boolean', default: false },
      output: { type: 'string', short: 'o' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Security Scan Script

Usage: npx tsx .agents/skills/security-review/scripts/security-scan.ts [options]

Options:
  --path <dir>        Directory to scan (default: src/)
  --collections <dir> Collections directory (auto-detected if omitted)
  --skip-audit       Skip npm audit (faster)
  --output <file>    Write report to file
  --json             Output JSON instead of markdown
  --help             Show this help message

Scans for:
  - Hardcoded secrets (API keys, tokens, passwords)
  - Console.log statements
  - localStorage for tokens
  - SQL injection risks
  - eval() usage
  - Missing access control in collections
  - Insecure patterns
`)
    process.exit(0)
  }

  const scanPath = resolve(process.cwd(), values.path || 'src')

  // Auto-discover collections directory
  const collectionsCandidates = [
    values.collections,
    'src/server/payload/collections',
    'src/collections',
    'collections',
  ].filter(Boolean)

  let collectionsDir = ''
  for (const candidate of collectionsCandidates) {
    const path = resolve(process.cwd(), candidate)
    if (existsSync(path)) {
      collectionsDir = path
      break
    }
  }

  const findings: Finding[] = []

  log(`\n${COLORS.magenta}═══════════════════════════════════════${COLORS.reset}`)
  log(`${COLORS.magenta}  Security Scan${COLORS.reset}`)
  log(`${COLORS.magenta}═══════════════════════════════════════${COLORS.reset}\n`)

  log(`${COLORS.gray}Scanning: ${scanPath}${COLORS.reset}`)
  if (collectionsDir) {
    log(`${COLORS.gray}Collections: ${collectionsDir}${COLORS.reset}\n`)
  }

  // Scan source files
  const typescriptFiles = scanDirectory(scanPath, ['.ts', '.tsx'])

  log(`${COLORS.gray}Checking ${typescriptFiles.length} TypeScript files...${COLORS.reset}`)

  let checked = 0
  for (const file of typescriptFiles) {
    const fileFindings = checkFile(file, SECURITY_PATTERNS)
    findings.push(...fileFindings)
    checked++
    if (checked % 50 === 0) {
      process.stdout.write('.')
    }
  }
  console.log('')

  // Check collections for access control
  if (collectionsDir && existsSync(collectionsDir)) {
    log(`${COLORS.gray}Checking collections for access control...${COLORS.reset}`)
    const collectionFindings = checkCollections(collectionsDir)
    findings.push(...collectionFindings)
  }

  // Run npm audit (optional)
  let auditOutput = ''
  if (!values['skip-audit']) {
    log(`${COLORS.gray}Running npm audit...${COLORS.reset}`)
    try {
      auditOutput = execSync('pnpm audit --audit-level=high 2>&1 || true', {
        encoding: 'utf-8',
        timeout: 60000,
      })

      // Parse audit output for vulnerabilities
      const vulnMatch = auditOutput.match(/found (\d+) vulnerability/)
      if (vulnMatch) {
        const vulnCount = parseInt(vulnMatch[1], 10)
        if (vulnCount > 0) {
          findings.push({
            severity: vulnCount > 10 ? 'CRITICAL' : 'WARNING',
            category: 'Dependency Security',
            message: `npm audit found ${vulnCount} vulnerabilities`,
            file: 'package.json',
            suggestion: 'Run pnpm audit fix or pnpm update',
          })
        }
      }
    } catch (_) {
      // Audit may fail in some cases, continue anyway
    }
  }

  // Generate report
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length
  const warningCount = findings.filter((f) => f.severity === 'WARNING').length
  const infoCount = findings.filter((f) => f.severity === 'INFO').length

  const report: SecurityReport = {
    timestamp,
    status: criticalCount > 0 ? 'failed' : 'passed',
    findings,
    summary: {
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
      total: findings.length,
    },
  }

  // Output
  console.log('')
  if (report.status === 'passed') {
    log(`${COLORS.green}═══════════════════════════════════════${COLORS.reset}`)
    log(`${COLORS.green}  ✅ No critical security issues found${COLORS.reset}`)
    log(`${COLORS.green}═══════════════════════════════════════${COLORS.reset}\n`)
  } else {
    log(`${COLORS.red}═══════════════════════════════════════${COLORS.reset}`)
    log(`${COLORS.red}  ❌ ${criticalCount} critical issue(s) found${COLORS.reset}`)
    log(`${COLORS.red}═══════════════════════════════════════${COLORS.reset}\n`)

    // Show summary
    log(`${COLORS.red}Critical: ${criticalCount}${COLORS.reset}`)
    log(`${COLORS.yellow}Warning: ${warningCount}${COLORS.reset}`)
    log(`${COLORS.blue}Info: ${infoCount}${COLORS.reset}`)
    console.log('')
  }

  // Write output
  if (values.output) {
    const content = values.json ? generateJSONReport(report) : generateMarkdownReport(report)
    writeFileSync(values.output, content, 'utf-8')
    log(`${COLORS.gray}Report written to: ${values.output}${COLORS.reset}`)
  } else if (!values.json) {
    console.log(generateMarkdownReport(report))
  } else {
    console.log(generateJSONReport(report))
  }

  // Exit code
  process.exit(report.status === 'passed' ? 0 : 1)
}

main().catch((error) => {
  console.error('Security scan failed:', error)
  process.exit(1)
})
