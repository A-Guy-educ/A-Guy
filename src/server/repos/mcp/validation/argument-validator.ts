import { logger } from '@/infra/utils/logger'

const MAX_LIMIT = 10

const COLLECTION_ALLOWLISTS: Record<string, { where: Set<string>; sort: Set<string> }> = {
  courses: {
    where: new Set(['*']), // Allow any field
    sort: new Set(['title', 'createdAt', 'updatedAt']),
  },
  chapters: {
    where: new Set(['*']), // Allow any field
    sort: new Set(['order', 'title', 'createdAt', 'updatedAt']),
  },
  lessons: {
    where: new Set(['*']), // Allow any field
    sort: new Set(['order', 'title', 'createdAt', 'updatedAt']),
  },
  exercises: {
    where: new Set(['*']), // Allow any field
    sort: new Set(['order', 'title', 'createdAt', 'updatedAt']),
  },
  media: {
    where: new Set(['*']), // Allow any field
    sort: new Set(['filename', 'createdAt', 'updatedAt']),
  },
}

const TOOL_COLLECTION_MAP: Record<string, string> = {
  findCourses: 'courses',
  findChapters: 'chapters',
  findLessons: 'lessons',
  findExercises: 'exercises',
  findMedia: 'media',
}

export function validateAndSanitizeArgs(toolName: string, args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('Tool arguments must be an object')
  }

  const collection = TOOL_COLLECTION_MAP[toolName]
  if (!collection) {
    throw new Error(`Unknown tool name: ${toolName}`)
  }

  const allowlist = COLLECTION_ALLOWLISTS[collection]
  if (!allowlist) {
    throw new Error(`No allowlist configured for collection ${collection}`)
  }

  if (containsTenantField(args)) {
    throw new Error('Tenant field is not allowed in tool arguments')
  }

  const input = args as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}

  if ('id' in input && typeof input.id === 'string') {
    sanitized.id = input.id
  }

  if ('limit' in input) {
    const limit = Number(input.limit)
    if (!Number.isFinite(limit) || limit <= 0 || limit > MAX_LIMIT) {
      throw new Error(`Limit must be between 1 and ${MAX_LIMIT}`)
    }
    sanitized.limit = limit
  } else {
    sanitized.limit = MAX_LIMIT
  }

  if ('page' in input) {
    const page = Number(input.page)
    if (!Number.isFinite(page) || page <= 0) {
      throw new Error('Page must be a positive number')
    }
    sanitized.page = page
  }

  if ('sort' in input && typeof input.sort === 'string') {
    const sortField = input.sort.startsWith('-') ? input.sort.slice(1) : input.sort
    if (!allowlist.sort.has(sortField)) {
      throw new Error(`Sort field "${sortField}" is not allowed for ${collection}`)
    }
    sanitized.sort = input.sort
  }

  if ('where' in input && typeof input.where === 'string' && input.where.trim().length > 0) {
    let parsed: unknown
    try {
      parsed = JSON.parse(input.where)
    } catch (error) {
      logger.warn({ err: error }, '[MCP] Invalid where JSON, rejecting tool call')
      throw new Error('Where must be valid JSON')
    }

    if (!isAllowedFilter(parsed, allowlist.where)) {
      throw new Error('Where clause contains disallowed fields')
    }

    if (containsTenantField(parsed)) {
      throw new Error('Tenant field is not allowed in where clause')
    }

    sanitized.where = JSON.stringify(parsed)
  }

  return sanitized
}

function isAllowedFilter(filter: unknown, allowedFields: Set<string>): boolean {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return false
  }

  // Allow any field if '*' is in the allowlist
  const allowAll = allowedFields.has('*')

  const entries = Object.entries(filter as Record<string, unknown>)
  for (const [key, value] of entries) {
    if (key === 'and' || key === 'or') {
      if (!Array.isArray(value)) return false
      for (const item of value) {
        if (!isAllowedFilter(item, allowedFields)) {
          return false
        }
      }
      continue
    }

    // If allowAll is true, skip individual field check
    if (!allowAll && !allowedFields.has(key)) {
      return false
    }

    if (value && typeof value === 'object') {
      if (containsTenantField(value)) {
        return false
      }
      continue
    }
  }

  return true
}

function containsTenantField(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsTenantField(item))
  }

  const obj = value as Record<string, unknown>
  if ('tenant' in obj) {
    return true
  }

  return Object.values(obj).some((item) => containsTenantField(item))
}
