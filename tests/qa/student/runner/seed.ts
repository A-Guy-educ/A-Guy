/**
 * Seed preconditions - creates test data via Payload Local API
 * @fileType utility
 * @domain qa
 * @pattern seed-data
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Precondition } from '../schema/scenario.schema'
import type { ActionRef } from '../actions/types'
import { resolveRefs } from './ref-resolver'

function generateUniqueSlug(prefix: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${random}`
}

function entityToCollection(
  entity: string,
): 'users' | 'courses' | 'chapters' | 'lessons' | 'exercises' | 'conversations' | 'tenants' {
  const mapping = {
    user: 'users',
    course: 'courses',
    chapter: 'chapters',
    lesson: 'lessons',
    exercise: 'exercises',
    conversation: 'conversations',
    tenant: 'tenants',
  } as const
  return mapping[entity as keyof typeof mapping] || ('courses' as const)
}

// Cache for tenant ID to avoid creating multiple
let cachedTenantId: string | null = null
let cachedCategoryId: string | null = null

async function getOrCreateTenant(payload: Awaited<ReturnType<typeof getPayload>>): Promise<string> {
  if (cachedTenantId) {
    return cachedTenantId
  }

  // Get tenant from environment or use default
  const tenantSlug = process.env.DEFAULT_TENANT_SLUG || 'default'

  // Try to find existing tenant
  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (result.docs[0]) {
    cachedTenantId = result.docs[0].id as string
    return cachedTenantId
  }

  // Create new tenant
  const created = await payload.create({
    collection: 'tenants',
    data: {
      name: tenantSlug,
      slug: tenantSlug,
      status: 'active',
    },
    overrideAccess: true,
  })

  cachedTenantId = created.id as string
  return cachedTenantId
}

async function getOrCreateCategory(
  payload: Awaited<ReturnType<typeof getPayload>>,
): Promise<string> {
  if (cachedCategoryId) {
    return cachedCategoryId
  }

  // Try to find existing category
  const result = await payload.find({
    collection: 'categories',
    where: { slug: { equals: 'test-category' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (result.docs[0]) {
    cachedCategoryId = result.docs[0].id as string
    return cachedCategoryId
  }

  // Create new category
  const created = await payload.create({
    collection: 'categories',
    data: {
      title: 'Test Category',
      slug: 'test-category',
      locale: 'he',
    },
    overrideAccess: true,
  })

  cachedCategoryId = created.id as string
  return cachedCategoryId
}

export async function seedPreconditions(
  preconditions: Precondition[],
  refs: Record<string, ActionRef>,
): Promise<void> {
  const payload = await getPayload({ config })

  // Pre-create tenant if needed (for courses, chapters, lessons)
  const entitiesNeedingTenant = ['course', 'chapter', 'lesson', 'exercise']
  const needsTenant = preconditions.some((pre) => entitiesNeedingTenant.includes(pre.entity))

  let tenantId: string | null = null
  if (needsTenant) {
    tenantId = await getOrCreateTenant(payload)
  }

  for (const pre of preconditions) {
    if (pre.action !== 'seed') {
      throw new Error(`Unknown precondition action: ${pre.action}`)
    }

    // Resolve any refs in the data
    const resolvedData = resolveRefs(pre.data, refs)

    // Add unique slug if not provided
    if (!resolvedData.slug && !resolvedData.email) {
      resolvedData.slug = generateUniqueSlug(pre.entity)
    }

    // Set defaults based on entity type
    const data = resolvedData as Record<string, unknown>

    if (pre.entity === 'user') {
      // Generate unique email for user
      if (!data.email) {
        data.email = generateUniqueSlug('testuser') + '@example.com'
      }
      if (!data.password) {
        data.password = 'testPassword123!'
      }
      if (!data.name) {
        data.name = (data.email as string).split('@')[0]
      }
      if (!data.role) {
        data.role = 'student'
      }
    }

    if (pre.entity === 'course') {
      data.status = data.status || 'published'
      data.isActive = data.isActive ?? true
      data.accessType = data.accessType || 'free'
      data.locale = data.locale || 'he'
      data.courseLabel = data.courseLabel || 'TEST'
      data.order = data.order ?? 0
      data.pageAccessType = data.pageAccessType || 'free'
      data.contentStatus = data.contentStatus || 'none'
      data.contentStatusVisible = data.contentStatusVisible ?? true
      if (tenantId) {
        data.tenant = tenantId
      }
      // Add default category if not provided
      if (!data.categories) {
        const categoryId = await getOrCreateCategory(payload)
        data.categories = [categoryId]
      }
    }

    if (pre.entity === 'chapter') {
      data.status = data.status || 'published'
      data.isActive = data.isActive ?? true
      data.chapterLabel = data.chapterLabel || '1'
      data.slug = data.slug || generateUniqueSlug('chapter')
      if (tenantId) {
        data.tenant = tenantId
      }
    }

    if (pre.entity === 'lesson') {
      data.status = data.status || 'published'
      data.isActive = data.isActive ?? true
      data.type = data.type || 'learning'
      data.slug = data.slug || generateUniqueSlug('lesson')
      data.contentStatus = data.contentStatus || 'none'
      data.contentStatusVisible = data.contentStatusVisible ?? true
      if (tenantId) {
        data.tenant = tenantId
      }
    }

    if (pre.entity === 'exercise') {
      // Exercise content should already be in the data
    }

    if (pre.entity === 'conversation') {
      if (tenantId) {
        data.tenant = tenantId
      }
    }

    const collection = entityToCollection(pre.entity) as string

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc: any = await payload.create({
        collection: collection as any,
        data,
        overrideAccess: true,
      })

      // Build ref data with just the fields needed for actions
      const refData: ActionRef = {
        id: doc.id as string,
        slug: doc.slug as string | undefined,
        _collection: collection,
      }

      // For users, also store email and password for login
      if (pre.entity === 'user') {
        refData.email = data.email as string
        refData.password = data.password as string
      }

      // Store ref WITHOUT the $ prefix (resolveRefs strips it)
      const refKey = pre.ref.startsWith('$') ? pre.ref.slice(1) : pre.ref
      refs[refKey] = refData
    } catch (error) {
      console.error(`Failed to seed ${pre.entity}:`, error)
      throw error
    }
  }
}
