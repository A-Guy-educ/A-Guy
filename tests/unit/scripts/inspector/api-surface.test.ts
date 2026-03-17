import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

import {
  discoverRoutes,
  buildCatalog,
} from '../../../../scripts/inspector/plugins/project/api-surface/cataloger'
import {
  formatApiSurfaceDigest,
  formatApiSurfaceSlack,
  formatCriticalFlags,
} from '../../../../scripts/inspector/plugins/project/api-surface/formatter'
import { apiSurfaceAuditorPlugin } from '../../../../scripts/inspector/plugins/project/api-surface/index'
import type {
  InspectorContext,
  GitHubClient,
  ActionRequest,
} from '../../../../scripts/inspector/core/types'

vi.mock('fs')

// ============================================================================
// Helpers
// ============================================================================

function makeCtx(overrides: Partial<InspectorContext> = {}): InspectorContext {
  return {
    repo: 'owner/repo',
    dryRun: false,
    cycleNumber: 5,
    runTimestamp: new Date().toISOString(),
    state: { get: vi.fn(), set: vi.fn(), save: vi.fn() },
    github: {
      postComment: vi.fn(),
      getIssue: vi.fn().mockReturnValue({ body: null, title: null }),
      getOpenIssues: vi.fn().mockReturnValue([]),
      triggerWorkflow: vi.fn(),
      addLabel: vi.fn(),
      removeLabel: vi.fn(),
      setLifecycleLabel: vi.fn(),
      closeIssue: vi.fn(),
      getIssueComments: vi.fn().mockReturnValue([]),
      listWorkflowRuns: vi.fn().mockReturnValue([]),
      createIssue: vi.fn().mockReturnValue(42),
      searchIssues: vi.fn().mockReturnValue([]),
    } as GitHubClient,
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as InspectorContext['log'],
    ...overrides,
  }
}

// ============================================================================
// discoverRoutes
// ============================================================================

describe('discoverRoutes', () => {
  const mockFs = vi.mocked(fs)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty when no api directory', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false)
    const routes = discoverRoutes('/some/path')
    expect(routes).toHaveLength(0)
  })

  it('finds route files and extracts methods', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi
      .fn()
      .mockReturnValue('export async function GET() {}\nexport async function POST() {}')

    const routes = discoverRoutes('/root')
    expect(routes).toHaveLength(1)
    expect(routes[0].methods).toContain('GET')
    expect(routes[0].methods).toContain('POST')
  })

  it('detects payload.auth pattern', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('const user = await payload.auth(req)')

    const routes = discoverRoutes('/root')
    expect(routes[0].authPattern).toBe('payload.auth')
  })

  it('detects requireAuth pattern', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('requireAuth(req)')

    const routes = discoverRoutes('/root')
    expect(routes[0].authPattern).toBe('requireAuth')
  })

  it('detects withApiHandler pattern', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('export default withApiHandler(req)')

    const routes = discoverRoutes('/root')
    expect(routes[0].authPattern).toBe('withApiHandler')
  })

  it('detects CRON_SECRET pattern', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('process.env.CRON_SECRET')

    const routes = discoverRoutes('/root')
    expect(routes[0].authPattern).toBe('CRON_SECRET')
  })

  it('reports "none" when no auth pattern found', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('export async function GET() {}')

    const routes = discoverRoutes('/root')
    expect(routes[0].authPattern).toBe('none')
  })

  it('detects Zod validation (z.object, .safeParse)', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('const schema = z.object({}).safeParse(body)')

    const routes = discoverRoutes('/root')
    expect(routes[0].hasZodValidation).toBe(true)
  })

  it('detects error handling (try/catch)', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('try { } catch (e) { }')

    const routes = discoverRoutes('/root')
    expect(routes[0].hasErrorHandling).toBe(true)
  })

  it('detects error handling (withApiHandler)', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('withApiHandler(req)')

    const routes = discoverRoutes('/root')
    expect(routes[0].hasErrorHandling).toBe(true)
  })
})

// ============================================================================
// buildCatalog
// ============================================================================

describe('buildCatalog', () => {
  it('computes correct route counts', () => {
    const routes = [
      {
        path: 'a/route.ts',
        apiPath: '/api/a',
        methods: ['GET'],
        authPattern: 'payload.auth',
        hasZodValidation: true,
        hasErrorHandling: true,
      },
      {
        path: 'b/route.ts',
        apiPath: '/api/b',
        methods: ['POST'],
        authPattern: 'none',
        hasZodValidation: false,
        hasErrorHandling: false,
      },
    ]
    const catalog = buildCatalog(routes)

    expect(catalog.totalRoutes).toBe(2)
    expect(catalog.authenticatedRoutes).toBe(1)
    expect(catalog.unauthenticatedRoutes).toBe(1)
    expect(catalog.withValidation).toBe(1)
    expect(catalog.withoutValidation).toBe(1)
    expect(catalog.withErrorHandling).toBe(1)
    expect(catalog.withoutErrorHandling).toBe(1)
  })

  it('flags POST route without Zod validation', () => {
    const routes = [
      {
        path: 'test/route.ts',
        apiPath: '/api/test',
        methods: ['POST'],
        authPattern: 'payload.auth',
        hasZodValidation: false,
        hasErrorHandling: true,
      },
    ]
    const catalog = buildCatalog(routes)

    const validationFlag = catalog.flags.find((f) => f.issue.includes('validation'))
    expect(validationFlag).toBeDefined()
    expect(validationFlag!.severity).toBe('medium')
  })

  it('flags route without error handling', () => {
    const routes = [
      {
        path: 'test/route.ts',
        apiPath: '/api/test',
        methods: ['GET'],
        authPattern: 'payload.auth',
        hasZodValidation: true,
        hasErrorHandling: false,
      },
    ]
    const catalog = buildCatalog(routes)

    const errorFlag = catalog.flags.find((f) => f.issue.includes('error'))
    expect(errorFlag).toBeDefined()
    expect(errorFlag!.severity).toBe('low')
  })

  it('does NOT flag GET route without validation', () => {
    const routes = [
      {
        path: 'test/route.ts',
        apiPath: '/api/test',
        methods: ['GET'],
        authPattern: 'payload.auth',
        hasZodValidation: false,
        hasErrorHandling: true,
      },
    ]
    const catalog = buildCatalog(routes)

    // Should not have validation flag for GET-only routes
    const validationFlag = catalog.flags.find((f) => f.issue.includes('validation'))
    expect(validationFlag).toBeUndefined()
  })

  it('flags mutation route without authentication', () => {
    const routes = [
      {
        path: 'test/route.ts',
        apiPath: '/api/test',
        methods: ['POST'],
        authPattern: 'none',
        hasZodValidation: true,
        hasErrorHandling: true,
      },
    ]
    const catalog = buildCatalog(routes)

    const authFlag = catalog.flags.find((f) => f.issue.includes('authentication'))
    expect(authFlag).toBeDefined()
    expect(authFlag!.severity).toBe('high')
  })
})

// ============================================================================
// formatApiSurfaceDigest
// ============================================================================

describe('formatApiSurfaceDigest', () => {
  it('includes summary stats', () => {
    const catalog = {
      routes: [],
      totalRoutes: 10,
      authenticatedRoutes: 8,
      unauthenticatedRoutes: 2,
      withValidation: 6,
      withoutValidation: 4,
      withErrorHandling: 9,
      withoutErrorHandling: 1,
      flags: [],
    }

    const result = formatApiSurfaceDigest(catalog, 5)

    expect(result).toContain('Summary')
    expect(result).toContain('10')
    expect(result).toContain('Cycle #5')
  })

  it('includes route table', () => {
    const catalog = {
      routes: [
        {
          path: 'test/route.ts',
          apiPath: '/api/test',
          methods: ['GET'],
          authPattern: 'payload.auth',
          hasZodValidation: true,
          hasErrorHandling: true,
        },
      ],
      totalRoutes: 1,
      authenticatedRoutes: 1,
      unauthenticatedRoutes: 0,
      withValidation: 1,
      withoutValidation: 0,
      withErrorHandling: 1,
      withoutErrorHandling: 0,
      flags: [],
    }

    const result = formatApiSurfaceDigest(catalog, 1)

    expect(result).toContain('/api/test')
  })

  it('includes flags section when flags exist', () => {
    const catalog = {
      routes: [],
      totalRoutes: 0,
      authenticatedRoutes: 0,
      unauthenticatedRoutes: 0,
      withValidation: 0,
      withoutValidation: 0,
      withErrorHandling: 0,
      withoutErrorHandling: 0,
      flags: [{ route: '/api/test', issue: 'No validation', severity: 'medium' as const }],
    }

    const result = formatApiSurfaceDigest(catalog, 1)

    expect(result).toContain('Flags')
    expect(result).toContain('No validation')
  })

  it('omits flags section when no flags', () => {
    const catalog = {
      routes: [],
      totalRoutes: 0,
      authenticatedRoutes: 0,
      unauthenticatedRoutes: 0,
      withValidation: 0,
      withoutValidation: 0,
      withErrorHandling: 0,
      withoutErrorHandling: 0,
      flags: [],
    }

    const result = formatApiSurfaceDigest(catalog, 1)

    expect(result).not.toContain('Flags')
  })
})

// ============================================================================
// apiSurfaceAuditorPlugin
// ============================================================================

describe('apiSurfaceAuditorPlugin', () => {
  const mockFs = vi.mocked(fs)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has correct name, description, domain', () => {
    expect(apiSurfaceAuditorPlugin.name).toBe('api-surface-auditor')
    expect(apiSurfaceAuditorPlugin.description).toBe(
      'Catalog and audit all API routes for auth, validation, and error handling',
    )
    expect(apiSurfaceAuditorPlugin.domain).toBe('project')
  })

  it('returns empty array when no routes found', async () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false)
    const ctx = makeCtx()
    const actions = await apiSurfaceAuditorPlugin.run(ctx)
    expect(actions).toHaveLength(0)
  })

  it('returns digest action with catalog', async () => {
    // Setup: api dir with one route
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('export async function GET() {}')

    const ctx = makeCtx({ digestIssue: 817 })
    const actions = await apiSurfaceAuditorPlugin.run(ctx)

    expect(actions.length).toBeGreaterThan(0)
    const digestAction = actions.find((a: ActionRequest) => a.type === 'digest')
    expect(digestAction).toBeDefined()
    expect(digestAction!.title).toContain('API Surface')
  })

  it('all actions have 23h dedup window', async () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('export async function POST() {}') // POST without validation = flag

    const ctx = makeCtx({ digestIssue: 817 })
    const actions = await apiSurfaceAuditorPlugin.run(ctx)

    for (const action of actions) {
      expect(action.dedupWindowMinutes).toBe(23 * 60)
    }
  })

  it('execute posts comment to digest issue', async () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true)
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'api', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'test', isDirectory: () => true }] as unknown as fs.Dirent[])
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'route.ts', isDirectory: () => false }] as unknown as fs.Dirent[])
    mockFs.readFileSync = vi.fn().mockReturnValue('export async function GET() {}')

    const ctx = makeCtx({ digestIssue: 817 })
    const actions = await apiSurfaceAuditorPlugin.run(ctx)

    const digestAction = actions.find((a: ActionRequest) => a.type === 'digest')
    const result = await digestAction!.execute(ctx)

    expect(result.success).toBe(true)
    expect(ctx.github.postComment).toHaveBeenCalledWith(817, expect.any(String))
  })
})

// ============================================================================
// formatApiSurfaceSlack
// ============================================================================

describe('formatApiSurfaceSlack', () => {
  it('returns compact format', () => {
    const catalog = {
      routes: [],
      totalRoutes: 50,
      authenticatedRoutes: 40,
      unauthenticatedRoutes: 10,
      withValidation: 30,
      withoutValidation: 20,
      withErrorHandling: 45,
      withoutErrorHandling: 5,
      flags: [{ route: '/api/test', issue: 'No auth', severity: 'high' as const }],
    }

    const result = formatApiSurfaceSlack(catalog)

    expect(result).toContain('50 routes')
    expect(result).toContain('40 auth')
    expect(result).toContain('high')
  })
})

// ============================================================================
// formatCriticalFlags
// ============================================================================

describe('formatCriticalFlags', () => {
  it('returns empty string when no critical flags', () => {
    const catalog = {
      routes: [],
      totalRoutes: 0,
      authenticatedRoutes: 0,
      unauthenticatedRoutes: 0,
      withValidation: 0,
      withoutValidation: 0,
      withErrorHandling: 0,
      withoutErrorHandling: 0,
      flags: [{ route: '/api/test', issue: 'Low issue', severity: 'low' as const }],
    }

    const result = formatCriticalFlags(catalog)
    expect(result).toBe('')
  })

  it('returns markdown when critical flags exist', () => {
    const catalog = {
      routes: [],
      totalRoutes: 0,
      authenticatedRoutes: 0,
      unauthenticatedRoutes: 0,
      withValidation: 0,
      withoutValidation: 0,
      withErrorHandling: 0,
      withoutErrorHandling: 0,
      flags: [{ route: '/api/test', issue: 'No auth', severity: 'high' as const }],
    }

    const result = formatCriticalFlags(catalog)

    expect(result).toContain('Critical Flags')
    expect(result).toContain('/api/test')
  })
})
