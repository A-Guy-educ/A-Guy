/**
 * @fileType plugin
 * @domain inspector
 * @pattern api-surface-auditor-plugin
 * @ai-summary Catalog and audit all API routes for auth, validation, and error handling
 *
 * Discovers all route.ts files under src/app/api/, extracts:
 * - HTTP methods (GET, POST, PUT, PATCH, DELETE)
 * - Authentication pattern used
 * - Whether Zod validation is present
 * - Whether error handling (try/catch) is present
 *
 * Posts full catalog to digest issue #817.
 * No LLM calls — purely deterministic pattern matching.
 */

import type { InspectorPlugin, ActionRequest, InspectorContext } from '../../../core/types'
import { discoverRoutes, buildCatalog } from './cataloger'
import { formatApiSurfaceDigest, formatCriticalFlags } from './formatter'

const DEDUP_WINDOW_MINUTES = 23 * 60

/**
 * API Surface Auditor plugin.
 *
 * Runs ~daily (every 6th cycle + 23h dedup).
 */
export const apiSurfaceAuditorPlugin: InspectorPlugin = {
  name: 'api-surface-auditor',
  description: 'Catalog and audit all API routes for auth, validation, and error handling',
  domain: 'project',
  schedule: { every: 1 }, // Daily

  async run(ctx): Promise<ActionRequest[]> {
    ctx.log.debug('Running api-surface-auditor plugin')

    const routes = discoverRoutes(process.cwd())

    if (routes.length === 0) {
      ctx.log.info('No API routes found — skipping api-surface-auditor')
      return []
    }

    const catalog = buildCatalog(routes)

    ctx.log.info(
      {
        totalRoutes: catalog.totalRoutes,
        authenticated: catalog.authenticatedRoutes,
        unauthenticated: catalog.unauthenticatedRoutes,
        withValidation: catalog.withValidation,
        flags: catalog.flags.length,
        highFlags: catalog.flags.filter((f) => f.severity === 'high').length,
      },
      'API surface audit complete',
    )

    const actions: ActionRequest[] = []

    // Digest comment action with full catalog
    if (ctx.digestIssue) {
      actions.push({
        plugin: 'api-surface-auditor',
        type: 'digest',
        urgency: 'info',
        title: '🌐 API Surface Audit Report',
        detail: formatSlackSummary(catalog),
        dedupKey: 'api-surface:digest-daily',
        dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
        async execute(execCtx: InspectorContext): Promise<{ success: boolean; message?: string }> {
          if (!execCtx.digestIssue) {
            return { success: false, message: 'Digest issue not configured at execution time' }
          }
          const markdown = formatApiSurfaceDigest(catalog, execCtx.cycleNumber)
          execCtx.github.postComment(execCtx.digestIssue, markdown)
          return { success: true, message: 'Digest posted' }
        },
      })

      // Additional warning action for critical flags
      const highFlags = catalog.flags.filter((f) => f.severity === 'high')
      if (highFlags.length > 0) {
        actions.push({
          plugin: 'api-surface-auditor',
          type: 'digest',
          urgency: 'warning',
          title: '⚠️ API Surface Critical Flags',
          detail: `${highFlags.length} high-severity flags detected`,
          dedupKey: 'api-surface:critical-flags-daily',
          dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
          async execute(
            execCtx: InspectorContext,
          ): Promise<{ success: boolean; message?: string }> {
            if (!execCtx.digestIssue) {
              return { success: false, message: 'Digest issue not configured at execution time' }
            }
            const markdown = formatCriticalFlags(catalog)
            execCtx.github.postComment(execCtx.digestIssue, markdown)
            return { success: true, message: 'Critical flags posted' }
          },
        })
      }
    }

    return actions
  },
}

// ============================================================================
// Helper
// ============================================================================

function formatSlackSummary(catalog: {
  totalRoutes: number
  authenticatedRoutes: number
  withValidation: number
  flags: { severity: string }[]
}): string {
  const highFlags = catalog.flags.filter((f) => f.severity === 'high').length
  return `API Surface: ${catalog.totalRoutes} routes | ${catalog.authenticatedRoutes} auth | ${catalog.withValidation} validated${highFlags > 0 ? ` | ${highFlags} high-severity flags` : ''}`
}
