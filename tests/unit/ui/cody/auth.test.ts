/**
 * Unit Tests for Cody Admin Auth Functions
 *
 * Tests the dashboard authentication middleware that uses Payload auth
 * to verify user authentication and admin role checking.
 */
import { NextRequest } from 'next/server'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock the payload module
vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

// Mock the config
vi.mock('@payload-config', () => ({
  default: {},
}))

// Import after mocks are set up
import { getPayload } from 'payload'
import { requireDashboardAuth, requireAdminAuth, requireAuth } from '@/ui/cody/auth'

describe('requireDashboardAuth', () => {
  let mockPayload: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    mockPayload = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getPayload).mockResolvedValue({ auth: mockPayload } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return authenticated: true with user when valid authenticated user', async () => {
    // Arrange
    const mockUser = {
      id: 'user-123',
      email: 'admin@example.com',
      role: 'admin',
    }
    mockPayload.mockResolvedValue({ user: mockUser })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireDashboardAuth(req)

    // Assert
    expect(result.authenticated).toBe(true)
    expect(result.user).toEqual({
      id: 'user-123',
      email: 'admin@example.com',
      role: 'admin',
    })
  })

  it('should return authenticated: false when no user', async () => {
    // Arrange
    mockPayload.mockResolvedValue({ user: undefined })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireDashboardAuth(req)

    // Assert
    expect(result.authenticated).toBe(false)
    expect(result.user).toBeUndefined()
  })

  it('should return authenticated: false when user is null', async () => {
    // Arrange
    mockPayload.mockResolvedValue({ user: null })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireDashboardAuth(req)

    // Assert
    expect(result.authenticated).toBe(false)
    expect(result.user).toBeUndefined()
  })

  it('should return authenticated: true with user when user has role student', async () => {
    // Arrange
    const mockUser = {
      id: 'user-456',
      email: 'student@example.com',
      role: 'student',
    }
    mockPayload.mockResolvedValue({ user: mockUser })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireDashboardAuth(req)

    // Assert
    expect(result.authenticated).toBe(true)
    expect(result.user).toEqual({
      id: 'user-456',
      email: 'student@example.com',
      role: 'student',
    })
  })

  it('should handle user without role field', async () => {
    // Arrange
    const mockUser = {
      id: 'user-789',
      email: 'user@example.com',
    }
    mockPayload.mockResolvedValue({ user: mockUser })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireDashboardAuth(req)

    // Assert
    expect(result.authenticated).toBe(true)
    expect(result.user).toEqual({
      id: 'user-789',
      email: 'user@example.com',
      role: undefined,
    })
  })

  it('should handle auth errors gracefully', async () => {
    // Arrange
    mockPayload.mockRejectedValue(new Error('Auth error'))

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireDashboardAuth(req)

    // Assert
    expect(result.authenticated).toBe(false)
    expect(result.user).toBeUndefined()
  })
})

describe('requireAdminAuth', () => {
  let mockPayload: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    mockPayload = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getPayload).mockResolvedValue({ auth: mockPayload } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return authenticated: true when user has admin role', async () => {
    // Arrange
    const mockUser = {
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'admin',
    }
    mockPayload.mockResolvedValue({ user: mockUser })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireAdminAuth(req)

    // Assert
    expect(result.authenticated).toBe(true)
    expect(result.user).toEqual({
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'admin',
    })
  })

  it('should return authenticated: false when user is not admin (role is student)', async () => {
    // Arrange
    const mockUser = {
      id: 'student-123',
      email: 'student@example.com',
      role: 'student',
    }
    mockPayload.mockResolvedValue({ user: mockUser })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireAdminAuth(req)

    // Assert
    expect(result.authenticated).toBe(false)
    expect(result.user).toBeUndefined()
  })

  it('should return authenticated: false when user is not authenticated', async () => {
    // Arrange
    mockPayload.mockResolvedValue({ user: undefined })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireAdminAuth(req)

    // Assert
    expect(result.authenticated).toBe(false)
    expect(result.user).toBeUndefined()
  })

  it('should return authenticated: false when user has no role field', async () => {
    // Arrange
    const mockUser = {
      id: 'user-123',
      email: 'user@example.com',
    }
    mockPayload.mockResolvedValue({ user: mockUser })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireAdminAuth(req)

    // Assert
    expect(result.authenticated).toBe(false)
    expect(result.user).toBeUndefined()
  })

  it('should return authenticated: false when user role is empty string', async () => {
    // Arrange
    const mockUser = {
      id: 'user-123',
      email: 'user@example.com',
      role: '',
    }
    mockPayload.mockResolvedValue({ user: mockUser })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireAdminAuth(req)

    // Assert
    expect(result.authenticated).toBe(false)
    expect(result.user).toBeUndefined()
  })
})

describe('requireAuth', () => {
  let mockPayload: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    mockPayload = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getPayload).mockResolvedValue({ auth: mockPayload } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return null when user is authenticated as admin', async () => {
    // Arrange
    const mockUser = {
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'admin',
    }
    mockPayload.mockResolvedValue({ user: mockUser })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireAuth(req)

    // Assert
    expect(result).toBeNull()
  })

  it('should return 401 NextResponse when user is not authenticated', async () => {
    // Arrange
    mockPayload.mockResolvedValue({ user: undefined })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireAuth(req)

    // Assert
    expect(result).not.toBeNull()
    expect(result?.status).toBe(401)
    const json = await result?.json()
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('should return 401 NextResponse when user is not admin (student role)', async () => {
    // Arrange
    const mockUser = {
      id: 'student-123',
      email: 'student@example.com',
      role: 'student',
    }
    mockPayload.mockResolvedValue({ user: mockUser })

    const req = new NextRequest('http://localhost')

    // Act
    const result = await requireAuth(req)

    // Assert
    expect(result).not.toBeNull()
    expect(result?.status).toBe(401)
    const json = await result?.json()
    expect(json).toEqual({ error: 'Unauthorized' })
  })
})
