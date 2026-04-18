/**
 * Tenant Service
 *
 * @fileType service
 * @domain tenant
 * @pattern tenant
 * @ai-summary Provides tenant-related utility functions
 */

import type { Payload } from 'payload'

import { getDefaultTenantId as getTenantIdFromRepos } from '@/server/repos/tenant/get-default-tenant'

/**
 * Get the default tenant ID for the current context.
 * Delegates to the repos layer which handles caching.
 */
export async function getDefaultTenantId(payload: Payload): Promise<string> {
  return getTenantIdFromRepos(payload)
}
