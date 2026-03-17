/**
 * @fileType utility
 * @domain inspector
 * @pattern security-scanner-rules
 * @ai-summary Defines security scanning rules for API routes, collections, and source files
 */

// ============================================================================
// Types
// ============================================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface SecurityFinding {
  rule: string
  severity: Severity
  file: string
  line?: number
  message: string
  detail: string
}

// ============================================================================
// Auth detection patterns
// ============================================================================

/**
 * Patterns that indicate authentication is present in an API route.
 * If NONE of these are found, the route is flagged as unauthenticated.
 */
export const AUTH_PATTERNS: RegExp[] = [
  /payload\.auth\s*\(/,
  /req\.user/,
  /requireAuth\s*\(/,
  /requireDashboardAuth\s*\(/,
  /requireAdminOrTestSecret\s*\(/,
  /withApiHandler\s*\(/,
  /withCronMiddleware\s*\(/,
  /CRON_SECRET/,
]

/**
 * Routes that are intentionally public and should NOT be flagged.
 * Paths are relative to `src/app/api/`.
 */
export const PUBLIC_ROUTE_ALLOWLIST: string[] = [
  'health/route.ts',
  'oauth/google/route.ts',
  'oauth/google/callback/route.ts',
  'example/route.ts',
  'cody/boards/route.ts', // intentional public endpoint
  'chapters/by-grade/route.ts', // public content
  'pdfjs-viewer/route.ts', // viewer proxy
]

// ============================================================================
// overrideAccess detection
// ============================================================================

/**
 * Directories where `overrideAccess: true` is expected and should NOT be flagged.
 * These are server-side contexts that intentionally bypass access control.
 */
export const OVERRIDE_ACCESS_ALLOWED_DIRS: string[] = [
  'src/server/payload/hooks/',
  'src/server/payload/jobs/',
  'src/server/payload/endpoints/',
  'src/server/services/',
  'scripts/',
  'tests/',
  'seed/',
]

// ============================================================================
// Hardcoded secret patterns
// ============================================================================

/**
 * Regex patterns that match potential hardcoded secrets.
 * Each has a label for the finding message.
 */
export interface SecretPattern {
  label: string
  pattern: RegExp
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    label: 'AWS access key',
    pattern: /['"]AKIA[0-9A-Z]{16}['"]/,
  },
  {
    label: 'Generic API key assignment',
    pattern: /(?:api[_-]?key|apikey|api_secret)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i,
  },
  {
    label: 'Private key block',
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
  },
  {
    label: 'JWT token',
    pattern: /['"]eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}['"]/,
  },
]

/**
 * Files/directories to exclude from secret scanning.
 */
export const SECRET_SCAN_EXCLUDES: string[] = [
  'node_modules/',
  '.next/',
  '.git/',
  'tests/',
  '.env',
  'pnpm-lock.yaml',
  'package-lock.json',
  '*.test.ts',
  '*.spec.ts',
  '*.md',
  '*.json',
]

// ============================================================================
// Collection access control
// ============================================================================

/**
 * Access operations that should NOT use `anyone` (i.e. write operations).
 * `read: anyone` is acceptable for public content.
 */
export const WRITE_OPERATIONS = ['create', 'update', 'delete'] as const

/**
 * Pattern to detect `anyone` being imported/used in access control for write ops.
 */
export const ANYONE_ACCESS_PATTERN = /anyone/
