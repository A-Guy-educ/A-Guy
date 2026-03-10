/**
 * Shared Authentication/Guest Resolution Middleware
 *
 * Centralizes authentication and guest session resolution for all chat-related endpoints.
 * Eliminates duplicated auth logic and ensures consistent security behavior.
 *
 * @fileType middleware
 * @domain auth
 * @pattern guest-session, rate-limiting
 * @ai-summary Shared resolver for authenticated users and guest sessions
 *
 * Features:
 * - Authentication via Payload (req.user or payload.auth())
 * - Guest session resolution from cookies/headers
 * - Optional rate limiting for guest creation
 * - Optional guest message limit enforcement
 * - Caching on req.context to prevent duplicate lookups
 *
 * Security:
 * - Never represents guests as Payload users (req.user remains null for guests)
 * - Rate limit check happens BEFORE guest session creation
 * - Guest message limits enforced consistently for all guest sessions
 */

import type { PayloadRequest } from 'payload'

import { isUsersCollectionUser } from '@/server/payload/access/isUsersCollectionUser'
import { checkRateLimit } from '@/server/services/rate-limit'
import {
  buildGuestSessionCookieHeader,
  checkAndIncrementGuestMessageCount,
  createGuestSession,
  getGuestSessionByToken,
  getGuestSessionByTokenAnyStatus,
  getGuestSessionCookie,
  hashIP,
  hashUserAgent,
  type GuestSessionDoc,
} from '@/server/services/guest-session'

/**
 * Options for resolving authentication or guest session
 */
export interface ResolveAuthOrGuestOptions {
  /**
   * Whether to allow creating a new guest session when none exists.
   * If false and no valid guest session exists, returns 'unauthenticated'.
   * @default false
   */
  allowGuestCreation?: boolean

  /**
   * Whether to enforce rate limiting before creating a new guest session.
   * Only applies when allowGuestCreation is true.
   * @default false
   */
  enforceRateLimit?: boolean

  /**
   * Whether to enforce guest message limits for existing guest sessions.
   * @default false
   */
  enforceGuestMessageLimit?: boolean
}

/**
 * Discriminated union result types for auth resolution
 */
export type AuthResolutionResult =
  | AuthResolutionAuthenticated
  | AuthResolutionGuest
  | AuthResolutionUnauthenticated
  | AuthResolutionRateLimited
  | AuthResolutionGuestMessageLimit
  | AuthResolutionSessionClaiming

export interface AuthResolutionAuthenticated {
  kind: 'authenticated'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any
}

export interface AuthResolutionGuest {
  kind: 'guest'
  guestSession: GuestSessionDoc
  isNew: boolean
  cookieHeaders: string[]
}

export interface AuthResolutionUnauthenticated {
  kind: 'unauthenticated'
}

export interface AuthResolutionRateLimited {
  kind: 'rate-limited'
  retryAfter: number
  remaining: number
  resetAt: number
}

export interface AuthResolutionGuestMessageLimit {
  kind: 'guest-message-limit'
}

export interface AuthResolutionSessionClaiming {
  kind: 'session-claiming'
}

/**
 * Resolve authentication or guest session from request
 *
 * @param req - Payload request with payload, headers, and optional user
 * @param options - Resolution options (guest creation, rate limiting, message limits)
 * @returns Discriminated union result with auth state and any cookie headers
 *
 * @example
 * // Basic usage - just check auth
 * const result = await resolveAuthOrGuest(req, {})
 * if (result.kind === 'unauthenticated') {
 *   return Response.json({ error: 'Unauthorized' }, { status: 401 })
 * }
 *
 * @example
 * // With guest creation and rate limiting
 * const result = await resolveAuthOrGuest(req, {
 *   allowGuestCreation: true,
 *   enforceRateLimit: true,
 *   enforceGuestMessageLimit: true,
 * })
 *
 * if (result.kind === 'rate-limited') {
 *   return Response.json(
 *     { error: 'Too many requests', retryAfter: result.retryAfter },
 *     { status: 429, headers: { 'Retry-After': String(result.retryAfter) } }
 *   )
 * }
 *
 * if (result.kind === 'guest-message-limit') {
 *   return Response.json(
 *     { error: 'Guest message limit reached' },
 *     { status: 429 }
 *   )
 * }
 */
export async function resolveAuthOrGuest(
  req: PayloadRequest,
  options: ResolveAuthOrGuestOptions = {},
): Promise<AuthResolutionResult> {
  const {
    allowGuestCreation = false,
    enforceRateLimit = false,
    enforceGuestMessageLimit = false,
  } = options

  // Check for cached result (FR-008)
  if (req.context?.__authResolution) {
    return req.context.__authResolution as AuthResolutionResult
  }

  // 1) Check for authenticated user (req.user set by Payload middleware)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = req.user ?? null

  // Fall back to payload.auth() if req.user not set or not a valid user
  if (!user || !isUsersCollectionUser(user)) {
    const authResult = await req.payload.auth({ headers: req.headers })
    // Only accept users from the users collection (not API keys)
    if (authResult.user && isUsersCollectionUser(authResult.user)) {
      user = authResult.user
    } else {
      user = null
    }
  }

  // 2) If authenticated user found, return early
  if (user) {
    const result: AuthResolutionAuthenticated = { kind: 'authenticated', user }
    cacheResult(req, result)
    return result
  }

  // 3) No authenticated user - check for guest session
  const guestToken = getGuestSessionCookie(req.headers as unknown as Headers)

  if (guestToken) {
    // Validate existing guest session
    const guestSession = await getGuestSessionByToken(req.payload, guestToken)

    if (guestSession) {
      // Existing guest session found
      const cookieHeaders: string[] = []

      // Check guest message limit if enforced
      if (enforceGuestMessageLimit) {
        const messageLimit = await checkAndIncrementGuestMessageCount(req.payload, guestSession.id)
        if (!messageLimit.allowed) {
          const result: AuthResolutionGuestMessageLimit = { kind: 'guest-message-limit' }
          cacheResult(req, result)
          return result
        }
      }

      const result: AuthResolutionGuest = {
        kind: 'guest',
        guestSession,
        isNew: false,
        cookieHeaders,
      }
      cacheResult(req, result)
      return result
    }

    // Guest session not found by getGuestSessionByToken (could be expired or in claiming state)
    // Check if session exists but is in claiming state - don't create new session as fallback
    const sessionAnyStatus = await getGuestSessionByTokenAnyStatus(req.payload, guestToken)
    if (sessionAnyStatus?.status === 'claiming') {
      const result: AuthResolutionSessionClaiming = { kind: 'session-claiming' }
      cacheResult(req, result)
      return result
    }
  }

  // 4) No valid guest session - can we create one?
  if (!allowGuestCreation) {
    const result: AuthResolutionUnauthenticated = { kind: 'unauthenticated' }
    cacheResult(req, result)
    return result
  }

  // 5) Guest creation allowed - compute hashes
  const ipHash = hashIP(req.headers?.get('x-forwarded-for') || req.headers?.get('x-real-ip'))
  const userAgentHash = hashUserAgent(req.headers?.get('user-agent'))

  // 6) Check rate limit BEFORE creating guest session (FR-004)
  if (enforceRateLimit) {
    const rateLimitResult = await checkRateLimit(ipHash, userAgentHash)
    if (!rateLimitResult.allowed) {
      const result: AuthResolutionRateLimited = {
        kind: 'rate-limited',
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt,
      }
      cacheResult(req, result)
      return result
    }
  }

  // 7) Create new guest session
  const { session, token } = await createGuestSession(req.payload, {
    ipHash,
    userAgentHash,
  })

  const guestCookieHeader = await buildGuestSessionCookieHeader(token)

  const result: AuthResolutionGuest = {
    kind: 'guest',
    guestSession: session,
    isNew: true,
    cookieHeaders: [guestCookieHeader],
  }

  cacheResult(req, result)
  return result
}

/**
 * Cache result on req.context to prevent duplicate lookups (FR-008)
 */
function cacheResult(req: PayloadRequest, result: AuthResolutionResult): void {
  if (req.context) {
    req.context.__authResolution = result
  }
}

/**
 * Helper to extract rate-limit response headers from rate-limited result
 */
export function getRateLimitHeaders(result: AuthResolutionRateLimited): HeadersInit {
  return {
    'Retry-After': String(result.retryAfter),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  }
}

/**
 * Helper to build a 429 response for rate limiting
 */
export function buildRateLimitResponse(result: AuthResolutionRateLimited): Response {
  return Response.json(
    {
      error: 'Too many requests. Please try again later.',
      isGuestMode: true,
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: getRateLimitHeaders(result),
    },
  )
}

/**
 * Helper to build a 429 response for guest message limit
 */
export function buildGuestMessageLimitResponse(): Response {
  return Response.json(
    {
      error: 'Guest message limit reached. Sign up for unlimited access.',
      isGuestMode: true,
      retryAfter: null,
    },
    {
      status: 429,
      headers: {
        'X-Guest-Message-Limit': 'true',
      },
    },
  )
}

/**
 * Helper to build a 401 response for unauthenticated requests
 */
export function buildUnauthenticatedResponse(): Response {
  return Response.json(
    { error: 'Authentication or guest session required', isGuestMode: false },
    { status: 401 },
  )
}

/**
 * Helper to build a 409 response for session claiming state
 */
export function buildSessionClaimingResponse(): Response {
  return Response.json(
    {
      error: 'Guest session is being claimed. Please try again.',
      isGuestMode: true,
      retryAfter: null,
    },
    {
      status: 409,
      headers: {
        'X-Guest-Session-Claiming': 'true',
      },
    },
  )
}
