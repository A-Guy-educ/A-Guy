/**
 * @fileType utility
 * @domain inspector
 * @pattern api-surface-cataloger
 * @ai-summary Discovers and catalogs all API route files with auth, validation, and error handling
 */

import * as fs from 'fs'
import * as path from 'path'

// Reuse allowlist from security-scanner
import { PUBLIC_ROUTE_ALLOWLIST } from '../security-scanner/rules'

// ============================================================================
// Types
// ============================================================================

export interface RouteInfo {
  path: string // e.g. 'cody/tasks/[taskId]/route.ts'
  apiPath: string // e.g. '/api/cody/tasks/[taskId]'
  methods: string[] // e.g. ['GET', 'POST']
  authPattern: string // e.g. 'requireAuth' | 'payload.auth' | 'withApiHandler' | 'CRON_SECRET' | 'none'
  hasZodValidation: boolean
  hasErrorHandling: boolean
}

export interface CatalogFlag {
  route: string
  issue: string
  severity: 'high' | 'medium' | 'low'
}

export interface ApiCatalog {
  routes: RouteInfo[]
  totalRoutes: number
  authenticatedRoutes: number
  unauthenticatedRoutes: number
  withValidation: number
  withoutValidation: number
  withErrorHandling: number
  withoutErrorHandling: number
  flags: CatalogFlag[]
}

// ============================================================================
// Helper: Recursive file discovery
// ============================================================================

function findRouteFiles(dir: string): string[] {
  const results: string[] = []

  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath))
    } else if (entry.name === 'route.ts') {
      results.push(fullPath)
    }
  }

  return results
}

// ============================================================================
// HTTP Method extraction
// ============================================================================

function extractMethods(content: string): string[] {
  const methods: string[] = []

  // Match: export async function GET(...) or export async function POST(...
  const functionPattern = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD)\s*\(/gi
  let match
  while ((match = functionPattern.exec(content)) !== null) {
    methods.push(match[1].toUpperCase())
  }

  // Match: export const GET = ... or export const POST = ...
  const constPattern = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD)\s*=/gi
  while ((match = constPattern.exec(content)) !== null) {
    methods.push(match[1].toUpperCase())
  }

  return [...new Set(methods)] // Dedupe
}

// ============================================================================
// Auth pattern detection
// ============================================================================

function detectAuthPattern(content: string): string {
  if (/payload\.auth\s*\(/.test(content)) return 'payload.auth'
  if (/requireAuth\s*\(/.test(content)) return 'requireAuth'
  if (/requireDashboardAuth\s*\(/.test(content)) return 'requireDashboardAuth'
  if (/requireAdminOrTestSecret\s*\(/.test(content)) return 'requireAdminOrTestSecret'
  if (/withApiHandler\s*\(/.test(content)) return 'withApiHandler'
  if (/withCronMiddleware\s*\(/.test(content)) return 'withCronMiddleware'
  if (/CRON_SECRET/.test(content)) return 'CRON_SECRET'

  return 'none'
}

// ============================================================================
// Validation detection
// ============================================================================

function detectZodValidation(content: string): boolean {
  // Look for Zod schema usage
  const zodPatterns = [
    /\bz\.object\s*\(/,
    /\bz\.string\s*\(/,
    /\bz\.number\s*\(/,
    /\bz\.boolean\s*\(/,
    /\.safeParse\s*\(/,
    /\.parse\s*\(/,
    /Schema\s*\(/,
    /InputSchema/,
  ]

  return zodPatterns.some((pattern) => pattern.test(content))
}

// ============================================================================
// Error handling detection
// ============================================================================

function detectErrorHandling(content: string): boolean {
  // Check for try/catch blocks
  if (/try\s*\{/.test(content)) return true

  // Check for wrapper handlers that provide error handling
  if (/withApiHandler\s*\(/.test(content)) return true
  if (/withCronMiddleware\s*\(/.test(content)) return true

  return false
}

// ============================================================================
// Route discovery
// ============================================================================

/**
 * Discover all API route files and extract metadata.
 */
export function discoverRoutes(rootDir: string): RouteInfo[] {
  const apiDir = path.join(rootDir, 'src/app/api')

  if (!fs.existsSync(apiDir)) return []

  const routeFiles = findRouteFiles(apiDir)
  const routes: RouteInfo[] = []

  for (const filePath of routeFiles) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const relativePath = path.relative(rootDir, filePath)

    // Convert to API path: src/app/api/cody/tasks/route.ts -> /api/cody/tasks
    let apiPath = relativePath.replace(/^src\/app\/api\//, '/api/').replace(/\/route\.ts$/, '')

    // Handle dynamic segments: [taskId] -> :taskId
    apiPath = apiPath.replace(/\[([^\]]+)\]/g, ':$1')

    const methods = extractMethods(content)
    const authPattern = detectAuthPattern(content)
    const hasZodValidation = detectZodValidation(content)
    const hasErrorHandling = detectErrorHandling(content)

    routes.push({
      path: relativePath,
      apiPath,
      methods,
      authPattern,
      hasZodValidation,
      hasErrorHandling,
    })
  }

  // Sort by API path
  routes.sort((a, b) => a.apiPath.localeCompare(b.apiPath))

  return routes
}

// ============================================================================
// Flagging logic
// ============================================================================

function createFlags(routes: RouteInfo[]): CatalogFlag[] {
  const flags: CatalogFlag[] = []

  for (const route of routes) {
    const hasMutationMethod = route.methods.some((m) =>
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m),
    )

    // Flag: POST/PUT/PATCH without Zod validation
    if (hasMutationMethod && !route.hasZodValidation) {
      // Check if not in allowlist
      const isAllowlisted = PUBLIC_ROUTE_ALLOWLIST.some((allowed) => route.path.endsWith(allowed))
      if (!isAllowlisted) {
        flags.push({
          route: route.apiPath,
          issue: 'Mutation method without Zod validation',
          severity: 'medium',
        })
      }
    }

    // Flag: Route without error handling
    if (!route.hasErrorHandling) {
      flags.push({
        route: route.apiPath,
        issue: 'No error handling (try/catch or wrapper)',
        severity: 'low',
      })
    }

    // Flag: Mutation route without authentication (unless allowlisted)
    if (hasMutationMethod && route.authPattern === 'none') {
      const isAllowlisted = PUBLIC_ROUTE_ALLOWLIST.some((allowed) => route.path.endsWith(allowed))
      if (!isAllowlisted) {
        flags.push({
          route: route.apiPath,
          issue: 'Mutation route without authentication',
          severity: 'high',
        })
      }
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return flags
}

// ============================================================================
// Catalog building
// ============================================================================

/**
 * Build a complete API surface catalog from discovered routes.
 */
export function buildCatalog(routes: RouteInfo[]): ApiCatalog {
  const authenticatedRoutes = routes.filter((r) => r.authPattern !== 'none').length
  const unauthenticatedRoutes = routes.filter((r) => r.authPattern === 'none').length
  const withValidation = routes.filter((r) => r.hasZodValidation).length
  const withoutValidation = routes.filter((r) => !r.hasZodValidation).length
  const withErrorHandling = routes.filter((r) => r.hasErrorHandling).length
  const withoutErrorHandling = routes.filter((r) => !r.hasErrorHandling).length
  const flags = createFlags(routes)

  return {
    routes,
    totalRoutes: routes.length,
    authenticatedRoutes,
    unauthenticatedRoutes,
    withValidation,
    withoutValidation,
    withErrorHandling,
    withoutErrorHandling,
    flags,
  }
}
