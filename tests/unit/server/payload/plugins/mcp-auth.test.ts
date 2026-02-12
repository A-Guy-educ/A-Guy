/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit Tests for MCP Plugin Auth Override
 *
 * Tests the session-based admin authentication override that allows
 * authenticated admin users to access MCP tools without requiring API keys.
 */
import type { User } from '@/payload-types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Store original fetch for restoration
const originalFetch = globalThis.fetch

describe('overrideAuth', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const createMockUser = (
    role: 'admin' | 'student' = 'student',
  ): User & { collection: 'users' } => ({
    id: 'user-123',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    email: 'test@example.com',
    role,
    collection: 'users',
  })

  const mockDefaultAuth = vi.fn(async () => ({
    user: undefined as unknown as any,
    courses: { find: false, create: false, update: false, delete: false },
    chapters: { find: false, create: false, update: false, delete: false },
    lessons: { find: false, create: false, update: false, delete: false },
    exercises: { find: false, create: false, update: false, delete: false },
    media: { find: false, create: false, update: false, delete: false },
  }))

  const createMockReq = (user: (User & { collection: 'users' }) | null) => {
    return {
      user,
      headers: new Headers(),
      payload: {} as unknown,
      depth: 0,
      fallbackLocale: undefined,
      locale: undefined,
      preference: {},
      req: {} as Request,
    } as unknown
  }

  it('grants access to admin users with correct role', async () => {
    const { overrideAuth } = await import('@/server/payload/plugins/mcp')
    const adminUser = createMockUser('admin')
    const mockReq = createMockReq(adminUser)

    const result = await overrideAuth(mockReq as any, mockDefaultAuth)

    expect(result.user).toEqual(adminUser)
    expect((result as any).courses.find).toBe(true)
    expect((result as any).chapters.find).toBe(true)
    expect((result as any).lessons.find).toBe(true)
    expect((result as any).exercises.find).toBe(true)
    expect((result as any).media.find).toBe(true)
  }, 15000)

  it('grants create access for courses, chapters, lessons to admins', async () => {
    const { overrideAuth } = await import('@/server/payload/plugins/mcp')
    const adminUser = createMockUser('admin')
    const mockReq = createMockReq(adminUser)

    const result = await overrideAuth(mockReq as any, mockDefaultAuth)

    const r = result as any
    expect(r.courses.create).toBe(true)
    expect(r.chapters.create).toBe(true)
    expect(r.lessons.create).toBe(true)
    expect(r.exercises.create).toBe(false)
    expect(r.media.create).toBe(false)
  })

  it('denies update and delete access to all collections for admins', async () => {
    const { overrideAuth } = await import('@/server/payload/plugins/mcp')
    const adminUser = createMockUser('admin')
    const mockReq = createMockReq(adminUser)

    const result = await overrideAuth(mockReq as any, mockDefaultAuth)

    const r = result as any
    expect(r.courses.update).toBe(false)
    expect(r.courses.delete).toBe(false)
    expect(r.chapters.update).toBe(false)
    expect(r.chapters.delete).toBe(false)
    expect(r.lessons.update).toBe(false)
    expect(r.lessons.delete).toBe(false)
  })

  it('preserves user object in result', async () => {
    const { overrideAuth } = await import('@/server/payload/plugins/mcp')
    const mockUser = createMockUser('admin')
    mockUser.email = 'admin@example.com'
    const mockReq = createMockReq(mockUser)

    const result = await overrideAuth(mockReq as any, mockDefaultAuth)

    expect(result.user).toBe(mockUser)
  })

  it('grants custom tool access for students without calling default auth', async () => {
    const { overrideAuth } = await import('@/server/payload/plugins/mcp')
    const studentUser = createMockUser('student')
    const mockReq = createMockReq(studentUser)

    const result = await overrideAuth(mockReq as any, mockDefaultAuth)

    // Students should NOT fall back to default auth - they get custom auth
    expect(mockDefaultAuth).not.toHaveBeenCalled()
    // Students get exercises.find access for getActiveExerciseContext tool
    expect((result as any).exercises.find).toBe(true)
    // Students get custom tool access
    expect((result as any).custom.getActiveExerciseContext).toBe(true)
  })

  it('falls back to default auth when no user', async () => {
    const { overrideAuth } = await import('@/server/payload/plugins/mcp')
    const mockReq = createMockReq(null)

    const result = await overrideAuth(mockReq as any, mockDefaultAuth)

    expect(mockDefaultAuth).toHaveBeenCalled()
    expect(result.user).toBeUndefined()
  })

  it('grants find access to all configured collections for admins', async () => {
    const { overrideAuth } = await import('@/server/payload/plugins/mcp')
    const adminUser = createMockUser('admin')
    const mockReq = createMockReq(adminUser)

    const result = await overrideAuth(mockReq as any, mockDefaultAuth)
    const r = result as any

    expect(r.courses.find).toBe(true)
    expect(r.chapters.find).toBe(true)
    expect(r.lessons.find).toBe(true)
    expect(r.exercises.find).toBe(true)
    expect(r.media.find).toBe(true)
  })

  it('grants find and create access for courses, chapters, lessons for admins', async () => {
    const { overrideAuth } = await import('@/server/payload/plugins/mcp')
    const adminUser = createMockUser('admin')
    const mockReq = createMockReq(adminUser)

    const result = await overrideAuth(mockReq as any, mockDefaultAuth)
    const r = result as any

    expect(r.courses.find).toBe(true)
    expect(r.courses.create).toBe(true)
    expect(r.courses.update).toBe(false)
    expect(r.courses.delete).toBe(false)

    expect(r.chapters.find).toBe(true)
    expect(r.chapters.create).toBe(true)
    expect(r.chapters.update).toBe(false)
    expect(r.chapters.delete).toBe(false)

    expect(r.lessons.find).toBe(true)
    expect(r.lessons.create).toBe(true)
    expect(r.lessons.update).toBe(false)
    expect(r.lessons.delete).toBe(false)

    expect(r.exercises.find).toBe(true)
    expect(r.exercises.create).toBe(false)
    expect(r.exercises.update).toBe(false)
    expect(r.exercises.delete).toBe(false)

    expect(r.media.find).toBe(true)
    expect(r.media.create).toBe(false)
    expect(r.media.update).toBe(false)
    expect(r.media.delete).toBe(false)
  })

  it('returns valid structure', async () => {
    const { overrideAuth } = await import('@/server/payload/plugins/mcp')
    const adminUser = createMockUser('admin')
    const mockReq = createMockReq(adminUser)

    const result = await overrideAuth(mockReq as any, mockDefaultAuth)
    const r = result as any

    expect(result).toHaveProperty('user')
    expect(r).toHaveProperty('courses')
    expect(r).toHaveProperty('chapters')
    expect(r).toHaveProperty('lessons')
    expect(r).toHaveProperty('exercises')
    expect(r).toHaveProperty('media')

    const collections = ['courses', 'chapters', 'lessons', 'exercises', 'media'] as const
    for (const collection of collections) {
      expect(r[collection]).toHaveProperty('find')
      expect(r[collection]).toHaveProperty('create')
      expect(r[collection]).toHaveProperty('update')
      expect(r[collection]).toHaveProperty('delete')
      expect(typeof r[collection].find).toBe('boolean')
      expect(typeof r[collection].create).toBe('boolean')
      expect(typeof r[collection].update).toBe('boolean')
      expect(typeof r[collection].delete).toBe('boolean')
    }
  })
})
