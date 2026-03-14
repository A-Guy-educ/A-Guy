/**
 * @fileType utility
 * @domain inspector
 * @pattern security-scanner-engine
 * @ai-summary Core scanning engine for detecting security vulnerabilities
 */

import * as fs from 'fs'
import * as path from 'path'

import type { SecurityFinding, Severity } from './rules'
import {
  AUTH_PATTERNS,
  PUBLIC_ROUTE_ALLOWLIST,
  OVERRIDE_ACCESS_ALLOWED_DIRS,
  SECRET_PATTERNS,
  SECRET_SCAN_EXCLUDES,
  ANYONE_ACCESS_PATTERN,
  WRITE_OPERATIONS,
} from './rules'

// ============================================================================
// Helper: Recursive file discovery
// ============================================================================

function findFiles(dir: string, pattern: RegExp, exclude: string[] = []): string[] {
  const results: string[] = []

  if (!fs.existsSync(dir)) return results

  let entries: fs.Dirent[] | undefined
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  if (!entries || !Array.isArray(entries)) return results

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    // Skip excluded patterns
    const shouldExclude = exclude.some((ex) => {
      if (ex.endsWith('/')) return fullPath.includes(ex)
      return entry.name === ex || fullPath.endsWith(ex)
    })
    if (shouldExclude) continue

    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, pattern, exclude))
    } else if (pattern.test(entry.name)) {
      results.push(fullPath)
    }
  }

  return results
}

// ============================================================================
// Scan 1: Routes without authentication
// ============================================================================

/**
 * Scan API route files for missing authentication.
 * Routes without any auth pattern are flagged unless they are in the allowlist.
 */
export function scanRoutesForMissingAuth(rootDir: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const apiDir = path.join(rootDir, 'src/app/api')

  if (!fs.existsSync(apiDir)) return findings

  const routeFiles = findFiles(apiDir, /route\.ts$/)

  for (const filePath of routeFiles) {
    const relativePath = path.relative(rootDir, filePath)
    const content = fs.readFileSync(filePath, 'utf-8')

    // Check if any auth pattern is present
    const hasAuth = AUTH_PATTERNS.some((pattern) => pattern.test(content))

    if (hasAuth) continue

    // Check if route is allowlisted
    const isAllowlisted = PUBLIC_ROUTE_ALLOWLIST.some((allowed) => relativePath.endsWith(allowed))
    if (isAllowlisted) continue

    // Determine severity based on mutation methods
    const hasMutationMethod =
      /\bexport\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(content) ||
      /\bexport\s+const\s+(POST|PUT|PATCH|DELETE)\s*=/.test(content)

    const severity: Severity = hasMutationMethod ? 'critical' : 'high'

    // Convert to API path: src/app/api/cody/tasks/[taskId]/route.ts -> /api/cody/tasks/:taskId
    const apiPath = relativePath
      .replace(/^src\/app\/api\//, '/api/')
      .replace(/\/route\.ts$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1')

    findings.push({
      rule: 'missing-auth',
      severity,
      file: relativePath,
      message: `Route without authentication: ${apiPath}`,
      detail: hasMutationMethod
        ? 'Route has mutation methods (POST/PUT/PATCH/DELETE) but no authentication'
        : 'Route has no authentication check',
    })
  }

  return findings
}

// ============================================================================
// Scan 2: Routes with overrideAccess: true
// ============================================================================

/**
 * Scan API route files for overrideAccess: true usage.
 * Only flags if the file is NOT in an allowed directory.
 */
export function scanRoutesForOverrideAccess(rootDir: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const apiDir = path.join(rootDir, 'src/app/api')

  if (!fs.existsSync(apiDir)) return findings

  const routeFiles = findFiles(apiDir, /route\.ts$/)

  // Pattern to match overrideAccess: true (with optional spaces)
  const overridePattern = /overrideAccess\s*[:=]\s*true/

  for (const filePath of routeFiles) {
    const relativePath = path.relative(rootDir, filePath)
    const content = fs.readFileSync(filePath, 'utf-8')

    if (!overridePattern.test(content)) continue

    // Check if file is in an allowed directory
    const isAllowedDir = OVERRIDE_ACCESS_ALLOWED_DIRS.some((dir) => relativePath.includes(dir))
    if (isAllowedDir) continue

    findings.push({
      rule: 'override-access',
      severity: 'high',
      file: relativePath,
      message: `Route uses overrideAccess: true in API handler`,
      detail: 'Bypasses Payload access control. Ensure this is intentional.',
    })
  }

  return findings
}

// ============================================================================
// Scan 3: Collections with permissive access (anyone on write ops)
// ============================================================================

/**
 * Scan collection configs for permissive access (anyone on create/update/delete).
 */
export function scanCollectionsForPermissiveAccess(rootDir: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const collectionsDir = path.join(rootDir, 'src/server/payload/collections')

  if (!fs.existsSync(collectionsDir)) return findings

  const collectionFiles = findFiles(collectionsDir, /\.ts$/)

  for (const filePath of collectionFiles) {
    const relativePath = path.relative(rootDir, filePath)
    const content = fs.readFileSync(filePath, 'utf-8')

    // Check if anyone is imported
    if (!ANYONE_ACCESS_PATTERN.test(content)) continue

    // Check if anyone is used in write operations
    // Simple heuristic: look for write operation followed by anyone
    const hasWriteWithAnyone = WRITE_OPERATIONS.some((op) => {
      // Match patterns like: create: anyone, update: anyone, delete: anyone
      const pattern = new RegExp(`${op}\\s*:\\s*anyone`)
      return pattern.test(content)
    })

    if (!hasWriteWithAnyone) continue

    findings.push({
      rule: 'permissive-access',
      severity: 'medium',
      file: relativePath,
      message: `Collection allows 'anyone' for write operations`,
      detail: 'Write operations (create/update/delete) should not be open to everyone',
    })
  }

  return findings
}

// ============================================================================
// Scan 4: Hardcoded secrets
// ============================================================================

/**
 * Scan source files for hardcoded secrets.
 */
export function scanForHardcodedSecrets(rootDir: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const srcDir = path.join(rootDir, 'src')

  if (!fs.existsSync(srcDir)) return findings

  const sourceFiles = findFiles(srcDir, /\.(ts|tsx)$/, SECRET_SCAN_EXCLUDES)

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(rootDir, filePath)
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1

      for (const secretDef of SECRET_PATTERNS) {
        if (secretDef.pattern.test(line)) {
          findings.push({
            rule: 'hardcoded-secret',
            severity: 'critical',
            file: relativePath,
            line: lineNumber,
            message: `Potential hardcoded secret: ${secretDef.label}`,
            detail: `Line ${lineNumber}: ${line.trim().substring(0, 80)}...`,
          })
        }
      }
    }
  }

  return findings
}

// ============================================================================
// Combined scan
// ============================================================================

/**
 * Run all security scans and combine findings.
 * Results are sorted by severity (critical first).
 */
export function runAllScans(rootDir: string): SecurityFinding[] {
  const allFindings: SecurityFinding[] = []

  allFindings.push(...scanRoutesForMissingAuth(rootDir))
  allFindings.push(...scanRoutesForOverrideAccess(rootDir))
  allFindings.push(...scanCollectionsForPermissiveAccess(rootDir))
  allFindings.push(...scanForHardcodedSecrets(rootDir))

  // Sort by severity priority: critical > high > medium > low
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return allFindings
}
