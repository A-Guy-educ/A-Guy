# Implementation Plan: Anonymous Chat via Expiring GuestSessions

> **For Junior Developers**: This plan includes code examples and references to existing files. Start with Phase 1 and follow the order. Look at the referenced files for patterns before implementing.

## TDD Workflow

This feature uses **Test-Driven Development** to ensure correctness. Each phase has **test gates** (G1-G12) that must pass before moving to the next phase.

**Red-Green-Refactor Cycle**:

1. **Red**: Write the test (defines expected behavior)
2. **Green**: Write minimal code to make test pass
3. **Refactor**: Improve code while keeping tests green

**Running Tests**:

```bash
# Run specific gate
pnpm vitest run tests/unit/guest-session.spec.ts -t "hashToken"

# Run all guest-chat tests
pnpm vitest run tests/int/guest-chat.int.spec.ts

# Run integration tests with MongoDB container
pnpm vitest run tests/int/guest-chat.int.spec.ts --reporter=verbose
```

**Test Requirements**:

- All test gates (G1-G12) must pass before Phase 10
- Use `createGuestSession` factory from `tests/factories/guest-session.factory.ts`
- Follow patterns from `tests/int/agent-chat.int.spec.ts` and `tests/int/conversations.int.spec.ts`
- Mock AI services (see `agent-chat.int.spec.ts` for pattern)

## Overview

This feature allows anonymous visitors to use the chat experience. Conversations persist across page reloads using expiring guest sessions. When a guest registers/logs in, their conversations transfer to their account.

**Key Architecture Decision**: We use **Option B** (explicit `user` + `guestSession` fields) for conversation ownership because:

- The `user` field already exists in `Conversations`
- Simpler than polymorphic `owner` field
- Cleaner queries with explicit relationships

---

## Security Invariants

These invariants MUST hold true. Tests for each are marked below.

| ID  | Invariant                | Description                                                           | Severity |
| --- | ------------------------ | --------------------------------------------------------------------- | -------- |
| S1  | No raw tokens in DB      | Only `tokenHash` is stored, never raw tokens                          | CRITICAL |
| S2  | Cookie security          | Cookie is HttpOnly, Secure (prod), SameSite=Lax                       | CRITICAL |
| S3  | Exactly-one-owner        | Conversation has `user` XOR `guestSession`, never both, never neither | CRITICAL |
| S4  | IDOR prevention          | Guest A cannot read Guest B's conversations                           | CRITICAL |
| S5  | Cross-tenant isolation   | Users cannot read guest convs; guests cannot read user convs          | CRITICAL |
| S6  | Expired session handling | Expired sessions are rejected; new sessions created transparently     | HIGH     |
| S7  | Atomic upgrade           | Login/signup: convs transfer + session revoked + cookie cleared       | HIGH     |
| S8  | Safe cleanup             | Cleanup deletes expired sessions but never active/claimed             | HIGH     |

---

## Consolidated Test Gates

| Gate | Phase | File                               | Level       | What it Tests                                                         | Enforces |
| ---- | ----- | ---------------------------------- | ----------- | --------------------------------------------------------------------- | -------- |
| G1   | 2     | `tests/unit/guest-session.spec.ts` | Unit        | Token hashing produces consistent SHA-256 hex, verify matches         | S1       |
| G2   | 2     | `tests/unit/guest-session.spec.ts` | Unit        | Cookie helpers set HttpOnly+Secure, parse correctly, clear            | S2       |
| G3   | 3     | `tests/int/guest-chat.int.spec.ts` | Integration | Create conv with both user+guest fails; create with neither fails     | S3       |
| G4   | 4     | `tests/int/guest-chat.int.spec.ts` | Integration | Guest sync chat: no auth → 200, creates session + conversation        | S1,S2    |
| G5   | 4     | `tests/int/guest-chat.int.spec.ts` | Integration | Guest stream chat: same as G4 for streaming endpoint                  | S1,S2    |
| G6   | 4     | `tests/int/guest-chat.int.spec.ts` | Integration | IDOR: Guest A cookie cannot access Guest B conversation               | S4       |
| G7   | 4     | `tests/int/guest-chat.int.spec.ts` | Integration | Cross-tenant: user can't read guest conv, guest can't read user conv  | S5       |
| G8   | 4     | `tests/int/guest-chat.int.spec.ts` | Integration | Expired session: request with expired cookie → new session created    | S6       |
| G9   | 6     | `tests/int/guest-chat.int.spec.ts` | Integration | Upgrade on login: guest convs → user, session revoked, cookie cleared | S7       |
| G10  | 6     | `tests/int/guest-chat.int.spec.ts` | Integration | Upgrade on signup: same as G9 via signup action                       | S7       |
| G11  | 7     | `tests/int/guest-chat.int.spec.ts` | Integration | Cleanup safety: deletes expired + their convs, NOT active/claimed     | S8       |
| G12  | 9     | `tests/int/guest-chat.int.spec.ts` | Integration | Rate limiting: 11th request in 1-min window returns 429               | -        |

---

## Quick Reference: File Changes Summary

### New Files to Create

| File                                                          | Purpose                            |
| ------------------------------------------------------------- | ---------------------------------- |
| `src/server/payload/collections/GuestSessions.ts`             | GuestSessions collection           |
| `src/server/services/guest-session.ts`                        | Token, cookie, CRUD operations     |
| `src/server/services/guest-session-upgrade.ts`                | Guest → user conversation transfer |
| `src/server/payload/endpoints/cron/guest-sessions-cleanup.ts` | Cron cleanup job                   |
| `src/server/services/rate-limit.ts`                           | Rate limiting for guests           |

### Modified Files

| File                                                            | Change                   |
| --------------------------------------------------------------- | ------------------------ |
| `src/server/payload/collections/Conversations.ts`               | Add `guestSession` field |
| `src/server/services/conversation-service.ts`                   | Support guest ownership  |
| `src/server/payload/endpoints/agent/chat.ts`                    | Guest auth support       |
| `src/server/payload/endpoints/agent/chat-stream.ts`             | Guest auth support       |
| `src/server/payload/endpoints/agent/get-conversation.ts`        | Guest auth support       |
| `src/server/payload/endpoints/agent/reset-chat.ts`              | Guest auth support       |
| `src/server/payload/endpoints/agent/chat/pipeline.ts`           | Guest support            |
| `src/server/payload/endpoints/agent/chat/context-resolution.ts` | Guest support            |
| `src/server/services/api/api-service.ts`                        | Guest mode support       |
| `src/ui/web/chat/ChatErrorSurface/index.tsx`                    | Guest mode UI            |
| `src/ui/web/chat/hooks/useNotebookChat.ts`                      | Guest mode detection     |
| `src/app/(frontend)/login/login_authenticate-action.ts`         | Claim guest sessions     |
| `src/app/(frontend)/signup/actions/signup_createUser-action.ts` | Claim guest sessions     |
| `src/payload.config.ts`                                         | Register GuestSessions   |

---

## Phase 1: Data Layer Foundation

### 1.1 Create GuestSessions Collection

**File**: `src/server/payload/collections/GuestSessions.ts`

**Pattern Reference**: Look at `src/server/payload/collections/Conversations.ts` for collection structure.

**Code Template**:

```typescript
/**
 * GuestSessions Collection
 * Stores expiring sessions for anonymous chat users
 *
 * @fileType collection-config
 * @domain auth
 * @pattern session-management, expiring-records
 */
import type { CollectionConfig } from 'payload'

export const GuestSessions: CollectionConfig = {
  slug: 'guest-sessions',
  admin: {
    useAsTitle: 'id',
    group: 'System',
    description: 'Anonymous user sessions for guest chat',
  },
  access: {
    read: () => false, // Never expose to clients
    create: () => true, // Auto-created for guests
    update: () => false,
    delete: ({ req }) => {
      // Allow cleanup job to delete (checks CRON_SECRET)
      return req.user?.collection === 'users' && req.user?.role === 'admin'
    },
  },
  fields: [
    {
      name: 'tokenHash',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'tokenVersion',
      type: 'number',
      required: true,
      defaultValue: 1,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'createdAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      index: true,
    },
    {
      name: 'lastActiveAt',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'hardExpiresAt',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'ipHash',
      type: 'text',
      index: true,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'userAgentHash',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Expired', value: 'expired' },
        { label: 'Revoked', value: 'revoked' },
      ],
      defaultValue: 'active',
      required: true,
      index: true,
    },
    {
      name: 'claimedByUser',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'claimedAt',
      type: 'date',
      admin: {
        hidden: true,
      },
    },
  ],
  timestamps: true,
}
```

**Tasks**:

- [ ] Create `src/server/payload/collections/GuestSessions.ts` with the collection config above
- [ ] Run `pnpm generate:types` to update TypeScript types

---

### 1.2 Update Conversations Collection

**File**: `src/server/payload/collections/Conversations.ts` (modify existing)

**Current Structure** (from line 60-68):

```typescript
{
  name: 'user',
  type: 'relationship',
  relationTo: 'users',
  required: true,  // <-- This will change to false
  index: true,
  admin: {
    description: 'Student who owns this conversation',
  },
},
```

**What to Add** (after the `user` field):

```typescript
{
  name: 'guestSession',
  type: 'relationship',
  relationTo: 'guest-sessions',
  required: false,
  index: true,
  admin: {
    hidden: true,
    description: 'Guest session owner (set for anonymous chats)',
  },
},
```

**Tasks**:

- [ ] Change `user` field `required: true` to `required: false`
- [ ] Add `guestSession` field (relationship to guest-sessions) after the `user` field
- [ ] Update the `beforeChange` hook (around line 261) to validate exactly one owner:
  ```typescript
  // Add this check at the start of the beforeChange hook
  if (operation === 'create' || operation === 'update') {
    const hasUser = Boolean(data.user)
    const hasGuest = Boolean(data.guestSession)
    if ((hasUser && hasGuest) || (!hasUser && !hasGuest)) {
      throw new Error('Conversation must have exactly one owner: user OR guestSession')
    }
  }
  ```
- [ ] Update `isOwner` access function (line 30) to support guests:

  ```typescript
  const isOwner: Access = ({ req, id }) => {
    const user = req.user as User | null
    if (!user) return false
    if (user.role === AccountRole.Admin) return true

    // Check if user owns this conversation
    return {
      and: [{ user: { equals: user.id } }, { guestSession: { exists: false } }],
    }
  }
  ```

- [ ] Run `pnpm generate:types`

---

### 1.3 Add Constants for Session Configuration

**File**: `src/server/config/constants.ts` (or create new file)

**Add**:

```typescript
// Guest Session Configuration
export const GUEST_SESSION_SLIDING_TTL_DAYS = 7
export const GUEST_SESSION_HARD_CAP_DAYS = 30
export const GUEST_SESSION_MAX_CONVERSATIONS = 5
```

---

## Phase 2: Session Management Service

### 2.1 Create Guest Session Service

**File**: `src/server/services/guest-session.ts`

**Pattern Reference**: Look at `src/server/services/conversation-service.ts` for service patterns.

**Code Template**:

```typescript
/**
 * Guest Session Service
 * Token generation, cookie management, and session CRUD operations
 *
 * @fileType service
 * @domain auth
 * @pattern session-management
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { logger } from '@/infra/utils/logger'
import {
  GUEST_SESSION_SLIDING_TTL_DAYS,
  GUEST_SESSION_HARD_CAP_DAYS,
} from '@/server/config/constants'

export const GUEST_SESSION_COOKIE_NAME = 'guest_session'

export interface GuestSessionDoc {
  id: string
  tokenHash: string
  tokenVersion: number
  createdAt: string
  lastActiveAt: string
  expiresAt: string
  hardExpiresAt: string
  status: 'active' | 'expired' | 'revoked'
  claimedByUser?: string
  claimedAt?: string
}

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Hash token for storage (never store raw tokens)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Verify token against stored hash
 */
export function verifyTokenHash(storedHash: string, token: string): boolean {
  const computedHash = hashToken(token)
  try {
    return crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(computedHash))
  } catch {
    return false
  }
}

/**
 * Set guest session cookie on response headers
 */
export function setGuestSessionCookie(token: string, headers: Headers = new Headers()): void {
  const maxAge = GUEST_SESSION_HARD_CAP_DAYS * 24 * 60 * 60
  const cookieValue = `${token}`

  headers.append(
    'Set-Cookie',
    [
      `${GUEST_SESSION_COOKIE_NAME}=${cookieValue}`,
      'HttpOnly',
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
      'SameSite=Lax',
      'Path=/',
      `Max-Age=${maxAge}`,
    ]
      .filter(Boolean)
      .join('; '),
  )
}

/**
 * Get guest session token from request headers
 */
export function getGuestSessionCookie(headers: Headers): string | null {
  const cookieHeader = headers.get('cookie')
  if (!cookieHeader) return null

  const match = cookieHeader.match(new RegExp(`${GUEST_SESSION_COOKIE_NAME}=([^;]+)`))
  return match?.[1] || null
}

/**
 * Clear guest session cookie
 */
export function clearGuestSessionCookie(headers: Headers = new Headers()): void {
  headers.append(
    'Set-Cookie',
    [
      `${GUEST_SESSION_COOKIE_NAME}=`,
      'HttpOnly',
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=0',
    ]
      .filter(Boolean)
      .join('; '),
  )
}

/**
 * Create a new guest session
 */
export async function createGuestSession(options: {
  req: PayloadRequest
  ipHash?: string
  userAgentHash?: string
}): Promise<{ session: GuestSessionDoc; token: string }> {
  const payload = await getPayload({ config })
  const token = generateSessionToken()
  const tokenHash = hashToken(token)
  const now = new Date()

  const hardExpiresAt = new Date(now)
  hardExpiresAt.setDate(hardExpiresAt.getDate() + GUEST_SESSION_HARD_CAP_DAYS)

  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + GUEST_SESSION_SLIDING_TTL_DAYS)

  const session = await payload.create({
    collection: 'guest-sessions',
    data: {
      tokenHash,
      tokenVersion: 1,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      hardExpiresAt: hardExpiresAt.toISOString(),
      status: 'active',
      ipHash: options.ipHash,
      userAgentHash: options.userAgentHash,
    },
  })

  logger.info({ sessionId: session.id }, 'Created guest session')

  return { session: session as GuestSessionDoc, token }
}

/**
 * Get active guest session by token
 */
export async function getGuestSessionByToken(token: string): Promise<GuestSessionDoc | null> {
  const payload = await getPayload({ config })
  const tokenHash = hashToken(token)

  const sessions = await payload.find({
    collection: 'guest-sessions',
    where: {
      and: [{ tokenHash: { equals: tokenHash } }, { status: { equals: 'active' } }],
    },
    limit: 1,
  })

  if (sessions.docs.length === 0) return null

  const session = sessions.docs[0] as GuestSessionDoc

  // Check expiration
  if (new Date(session.expiresAt) < new Date()) {
    return null
  }

  return session
}

/**
 * Update session activity (extends sliding TTL)
 */
export async function updateGuestSessionActivity(
  sessionId: string,
): Promise<GuestSessionDoc | null> {
  const payload = await getPayload({ config })
  const now = new Date()

  const session = await payload.findByID({
    collection: 'guest-sessions',
    id: sessionId,
  })

  if (!session || session.status !== 'active') {
    return null
  }

  const hardExpiresAt = new Date(session.hardExpiresAt)
  const newExpiresAt = new Date(now)
  newExpiresAt.setDate(newExpiresAt.getDate() + GUEST_SESSION_SLIDING_TTL_DAYS)

  // Clamp by hard cap
  if (newExpiresAt > hardExpiresAt) {
    newExpiresAt.setTime(hardExpiresAt.getTime())
  }

  const updated = await payload.update({
    collection: 'guest-sessions',
    id: sessionId,
    data: {
      lastActiveAt: now.toISOString(),
      expiresAt: newExpiresAt.toISOString(),
    },
  })

  return updated as GuestSessionDoc
}

/**
 * Revoke guest session (after upgrade claim)
 */
export async function revokeGuestSession(
  sessionId: string,
  claimedByUser: string,
): Promise<GuestSessionDoc | null> {
  const payload = await getPayload({ config })

  const updated = await payload.update({
    collection: 'guest-sessions',
    id: sessionId,
    data: {
      status: 'revoked',
      claimedByUser,
      claimedAt: new Date().toISOString(),
    },
  })

  return updated as GuestSessionDoc
}

/**
 * Hash IP address for abuse tracking (privacy-preserving)
 */
export function hashIP(ip: string | null): string {
  if (!ip) return ''
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

/**
 * Hash User-Agent for abuse tracking
 */
export function hashUserAgent(ua: string | null): string {
  if (!ua) return ''
  return crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16)
}
```

**Tasks**:

- [ ] Create `src/server/services/guest-session.ts` with the code above
- [ ] Export from `src/server/services/index.ts` (create if needed)

---

### Test Gate: G1 — Token Hashing (Unit)

**File**: `tests/unit/guest-session.spec.ts`
**Enforces**: S1 (No raw tokens in DB)
**Run**: `pnpm vitest run tests/unit/guest-session.spec.ts -t "hashToken"`
**Acceptance**: All tests PASS before proceeding to G2.

```typescript
import { generateSessionToken, hashToken, verifyTokenHash } from '@/server/services/guest-session'
import { describe, expect, it } from 'vitest'

describe('hashToken (G1)', () => {
  it('produces consistent SHA-256 hex digest', () => {
    const token = 'test-token-abc123'
    const hash1 = hashToken(token)
    const hash2 = hashToken(token)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA-256 = 64 hex chars
    expect(hash1).not.toBe(token) // Not stored raw
  })

  it('verifyTokenHash returns true for matching token', () => {
    const token = generateSessionToken()
    const hash = hashToken(token)
    expect(verifyTokenHash(hash, token)).toBe(true)
  })

  it('verifyTokenHash returns false for wrong token', () => {
    const hash = hashToken('correct-token')
    expect(verifyTokenHash(hash, 'wrong-token')).toBe(false)
  })
})

describe('generateSessionToken (G1)', () => {
  it('generates 64-character hex string', () => {
    const token = generateSessionToken()
    expect(token).toHaveLength(64)
    expect(/^[a-f0-9]+$/.test(token)).toBe(true)
  })

  it('generates unique tokens', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSessionToken())
    }
    expect(tokens.size).toBe(100) // No duplicates
  })
})
```

### Test Gate: G2 — Cookie Management (Unit)

**File**: `tests/unit/guest-session.spec.ts`
**Enforces**: S2 (Cookie security: HttpOnly, Secure, SameSite=Lax)
**Run**: `pnpm vitest run tests/unit/guest-session.spec.ts -t "cookie"`
**Acceptance**: All tests PASS before proceeding to Phase 3.

```typescript
import {
  setGuestSessionCookie,
  getGuestSessionCookie,
  clearGuestSessionCookie,
  GUEST_SESSION_COOKIE_NAME,
} from '@/server/services/guest-session'
import { describe, expect, it } from 'vitest'

describe('setGuestSessionCookie (G2)', () => {
  it('sets HttpOnly, Secure (prod), SameSite=Lax', () => {
    const headers = new Headers()
    setGuestSessionCookie('test-token-123', headers)

    const cookieHeader = headers.get('Set-Cookie')
    expect(cookieHeader).toContain('HttpOnly')
    expect(cookieHeader).toContain('SameSite=Lax')
    expect(cookieHeader).toContain(`${GUEST_SESSION_COOKIE_NAME}=test-token-123`)
    expect(cookieHeader).toContain('Max-Age=') // Has expiration
  })

  it('includes Secure flag in production', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const headers = new Headers()
      setGuestSessionCookie('token', headers)
      expect(headers.get('Set-Cookie')).toContain('Secure')
    } finally {
      process.env.NODE_ENV = originalEnv
    }
  })
})

describe('getGuestSessionCookie (G2)', () => {
  it('parses token from cookie header', () => {
    const headers = new Headers({ Cookie: `${GUEST_SESSION_COOKIE_NAME}=my-token-value` })
    expect(getGuestSessionCookie(headers)).toBe('my-token-value')
  })

  it('returns null when no cookie', () => {
    const headers = new Headers()
    expect(getGuestSessionCookie(headers)).toBeNull()
  })

  it('returns null for non-matching cookie', () => {
    const headers = new Headers({ Cookie: 'other-cookie=value' })
    expect(getGuestSessionCookie(headers)).toBeNull()
  })
})

describe('clearGuestSessionCookie (G2)', () => {
  it('sets cookie with Max-Age=0 to expire', () => {
    const headers = new Headers()
    clearGuestSessionCookie(headers)

    const cookieHeader = headers.get('Set-Cookie')
    expect(cookieHeader).toContain('Max-Age=0')
    expect(cookieHeader).toContain(`${GUEST_SESSION_COOKIE_NAME}=`)
  })
})
```

---

### 2.2 Create Guest Session Upgrade Service

**File**: `src/server/services/guest-session-upgrade.ts`

**Code Template**:

```typescript
/**
 * Guest Session Upgrade Service
 * Transfers guest conversations to authenticated users on login/register
 *
 * @fileType service
 * @domain auth
 * @pattern ownership-transfer
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { logger } from '@/infra/utils/logger'
import {
  getGuestSessionByToken,
  revokeGuestSession,
  clearGuestSessionCookie,
  type GuestSessionDoc,
} from './guest-session'

/**
 * Claim all conversations owned by a guest session for a user
 */
export async function claimGuestConversations(
  userId: string,
  sessionToken: string,
  headers: Headers = new Headers(),
): Promise<{ claimed: number; headers: Headers }> {
  const payload = await getPayload({ config })

  // Get and validate the guest session
  const session = await getGuestSessionByToken(sessionToken)
  if (!session) {
    logger.warn({ userId }, 'Guest session not found or expired during claim')
    clearGuestSessionCookie(headers)
    return { claimed: 0, headers }
  }

  // Find all conversations owned by this session
  const conversations = await payload.find({
    collection: 'conversations',
    where: {
      and: [
        { guestSession: { equals: session.id } },
        { archivedAt: { exists: false } }, // Only active conversations
      ],
    },
    limit: 100, // Should be enough for most cases
    depth: 0,
  })

  logger.info(
    { userId, sessionId: session.id, count: conversations.docs.length },
    'Claiming guest conversations',
  )

  // Transfer ownership of each conversation
  let claimed = 0
  for (const conv of conversations.docs) {
    await payload.update({
      collection: 'conversations',
      id: conv.id,
      data: {
        user: userId,
        guestSession: null as any, // Clear guest ownership
      },
      overrideAccess: true, // Required to clear the relationship
    })
    claimed++
  }

  // Revoke the guest session
  await revokeGuestSession(session.id, userId)

  // Clear the guest cookie
  clearGuestSessionCookie(headers)

  logger.info({ userId, sessionId: session.id, claimed }, 'Guest conversations claimed')

  return { claimed, headers }
}

/**
 * Check if user has pending guest conversations to claim
 */
export async function hasPendingGuestConversations(sessionToken: string): Promise<boolean> {
  const session = await getGuestSessionByToken(sessionToken)
  if (!session) return false

  const payload = await getPayload({ config })

  const conversations = await payload.count({
    collection: 'conversations',
    where: {
      and: [{ guestSession: { equals: session.id } }, { archivedAt: { exists: false } }],
    },
  })

  return conversations.totalDocs > 0
}
```

**Tasks**:

- [ ] Create `src/server/services/guest-session-upgrade.ts`
- [ ] Export from `src/server/services/index.ts`

---

## Phase 3: Update ConversationService

**File**: `src/server/services/conversation-service.ts` (modify existing)

The `ConversationService` needs to support both user-owned and guest-owned conversations.

**Current Method** (lines 70-118):

```typescript
async getOrCreateActiveConversation(
  userId: string,
  contextRef: ContextRef,
): Promise<ConversationWithHistory>
```

**What to Add**: Create an overloaded version or add a new method for guests:

```typescript
/**
 * Get or create active conversation for a GUEST session
 * Similar to user version but uses guestSession instead of user
 */
async getOrCreateGuestConversation(
  guestSessionId: string,
  contextRef: ContextRef,
): Promise<ConversationWithHistory> {
  const contextKey = `${contextRef.relationTo}:${contextRef.value}`

  // Try to find existing active conversation
  const existingConv = await this.payload.find({
    collection: 'conversations',
    where: {
      and: [
        { guestSession: { equals: guestSessionId } },
        { contextKey: { equals: contextKey } },
        { archivedAt: { exists: false } },
      ],
    },
    limit: 1,
  })

  if (existingConv.docs.length > 0) {
    return existingConv.docs[0] as unknown as ConversationWithHistory
  }

  // Create new conversation
  const newConv = await this.payload.create({
    collection: 'conversations',
    data: {
      guestSession: guestSessionId,
      contextRef: {
        relationTo: contextRef.relationTo,
        value: contextRef.value,
      },
      contextKey,
      messages: [],
      lastMessageAt: new Date(),
      contextPolicyVersion: 'v1',
    } as any,
    draft: false,
  })

  logger.info({ guestSessionId, contextKey, conversationId: newConv.id }, 'Created guest conversation')
  return newConv as unknown as ConversationWithHistory
}

/**
 * Get guest conversation by context key
 */
async getGuestConversation(
  guestSessionId: string,
  contextKey: string,
): Promise<ConversationWithHistory | null> {
  const result = await this.payload.find({
    collection: 'conversations',
    where: {
      and: [
        { guestSession: { equals: guestSessionId } },
        { contextKey: { equals: contextKey } },
        { archivedAt: { exists: false } },
      ],
    },
    limit: 1,
  })

  if (result.docs.length === 0) return null
  return result.docs[0] as unknown as ConversationWithHistory
}

/**
 * Reset guest conversation (archive + create new)
 */
async resetGuestConversation(
  guestSessionId: string,
  contextKey: string,
): Promise<ConversationWithHistory> {
  // Find and archive current
  const existing = await this.payload.find({
    collection: 'conversations',
    where: {
      and: [
        { guestSession: { equals: guestSessionId } },
        { contextKey: { equals: contextKey } },
        { archivedAt: { exists: false } },
      ],
    },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    const currentConv = existing.docs[0]
    await this.payload.update({
      collection: 'conversations',
      id: currentConv.id,
      data: { archivedAt: new Date() } as any,
      overrideAccess: true,
      context: { allowArchive: true },
    })
    logger.info({ guestSessionId, contextKey, conversationId: currentConv.id }, 'Archived guest conversation')
  }

  // Create new
  const [relationTo, value] = contextKey.split(':') as [ContextRef['relationTo'], string]
  const newConv = await this.payload.create({
    collection: 'conversations',
    data: {
      guestSession: guestSessionId,
      contextRef: { relationTo, value },
      contextKey,
      messages: [],
      lastMessageAt: new Date(),
      contextPolicyVersion: 'v1',
    } as any,
    draft: false,
  })

  logger.info({ guestSessionId, contextKey, conversationId: newConv.id }, 'Created new guest conversation after reset')
  return newConv as unknown as ConversationWithHistory
}
```

**Tasks**:

- [ ] Add `getOrCreateGuestConversation` method to `ConversationService`
- [ ] Add `getGuestConversation` method
- [ ] Add `resetGuestConversation` method
- [ ] Add `guestSessionId` to `ResolvedContext` type (line 31-35) to track ownership

### Test Gate: G3 — Exactly-One-Owner Constraint (Integration)

**File**: `tests/int/guest-chat.int.spec.ts`
**Enforces**: S3 (Conversation has exactly one owner)
**Run**: `pnpm vitest run tests/int/guest-chat.int.spec.ts -t "exactly one owner"`
**Acceptance**: All tests PASS before proceeding to Phase 4.

```typescript
describe('exactly one owner (G3)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    // Create test user and context hierarchy (see existing factories)
    const context = await createContextHierarchy(payload)
    testUserId = context.testUserId
    testExerciseId = context.exerciseId
  })

  it('rejects conversation with both user AND guestSession', async () => {
    // First create a guest session
    const { session: guestSession } = await createGuestSession(payload, {
      ipHash: 'test-ip-hash',
      userAgentHash: 'test-ua-hash',
    })

    await expect(
      payload.create({
        collection: 'conversations',
        data: {
          user: testUserId,
          guestSession: guestSession.id,
          contextRef: { relationTo: 'exercises', value: testExerciseId },
          messages: [],
          lastMessageAt: new Date(),
          contextPolicyVersion: 'v1',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/exactly one owner/i)
  })

  it('rejects conversation with neither user nor guestSession', async () => {
    await expect(
      payload.create({
        collection: 'conversations',
        data: {
          contextRef: { relationTo: 'exercises', value: testExerciseId },
          messages: [],
          lastMessageAt: new Date(),
          contextPolicyVersion: 'v1',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/exactly one owner/i)
  })

  it('accepts conversation with user only', async () => {
    const conv = await payload.create({
      collection: 'conversations',
      data: {
        user: testUserId,
        contextRef: { relationTo: 'exercises', value: testExerciseId },
        messages: [],
        lastMessageAt: new Date(),
        contextPolicyVersion: 'v1',
      },
      overrideAccess: true,
    })
    expect(conv.user).toBe(testUserId)
    expect(conv.guestSession).toBeUndefined()

    // Cleanup
    await payload.delete({ collection: 'conversations', id: conv.id, overrideAccess: true })
  })

  it('accepts conversation with guestSession only', async () => {
    const { session: guestSession } = await createGuestSession(payload, {})

    const conv = await payload.create({
      collection: 'conversations',
      data: {
        guestSession: guestSession.id,
        contextRef: { relationTo: 'exercises', value: testExerciseId },
        messages: [],
        lastMessageAt: new Date(),
        contextPolicyVersion: 'v1',
      },
      overrideAccess: true,
    })
    expect(conv.guestSession).toBe(guestSession.id)
    expect(conv.user).toBeUndefined()

    // Cleanup
    await payload.delete({ collection: 'conversations', id: conv.id, overrideAccess: true })
  })
})
```

---

## Phase 4: Update Chat Endpoints

### 4.1 Update Main Chat Handler

**File**: `src/server/payload/endpoints/agent/chat.ts` (modify existing)

**Key Changes**:

1. **Add guest session detection** (around line 86, where auth check happens):

```typescript
// 1) Check for authenticated user OR guest session
const { user } = await req.payload.auth({ headers: req.headers })

let guestSession: GuestSessionDoc | null = null

if (!user) {
  // Check for guest session
  const guestToken = getGuestSessionCookie(req.headers)
  if (guestToken) {
    guestSession = await getGuestSessionByToken(guestToken)
  }

  if (!guestSession) {
    // Create new guest session
    const ipHash = hashIP(req.headers?.get('x-forwarded-for') || req.headers?.get('x-real-ip'))
    const userAgentHash = hashUserAgent(req.headers?.get('user-agent'))
    const { session, token } = await createGuestSession({
      req,
      ipHash,
      userAgentHash,
    })
    guestSession = session
    setGuestSessionCookie(token, req.headers as any)
  }
}
```

2. **Replace `userId` usage with owner check** (throughout the handler):
   - For authenticated users: use `req.user.id`
   - For guests: use `guestSession.id`
   - Pass `guestSessionId` through the pipeline

3. **Update conversation operations**:
   - Replace calls to `conversationService.getOrCreateActiveConversation` with guest-aware version
   - Pass owner info through to `getOrCreateConversation` in `context-resolution.ts`

**Pattern Reference**: See lines 86-91 for auth check, 445-461 for conversation service usage.

**Tasks**:

- [ ] Import guest session utilities at top of file
- [ ] Add guest session detection and creation
- [ ] Update all `userId` references to be owner-aware
- [ ] Update conversation operations to support guests
- [ ] Update session activity after successful chat

---

### 4.2 Update Chat Pipeline

**File**: `src/server/payload/endpoints/agent/chat/pipeline.ts` (modify existing)

**Pattern Reference**: See lines 67-241 for the pipeline structure.

**Key Changes**:

- Add `guestSessionId?: string` parameter to `runChatPipeline`
- Update `getOrCreateConversation` call to use guest-aware version when `guestSessionId` is present
- Update ownership verification in the pipeline

---

### 4.3 Update Context Resolution

**File**: `src/server/payload/endpoints/agent/chat/context-resolution.ts` (modify existing)

**Pattern Reference**: See lines 103-115 for `getOrCreateConversation`.

**Key Changes**:

```typescript
export async function getOrCreateConversation(
  conversationService: ConversationService,
  owner: { type: 'user'; id: string } | { type: 'guest'; id: string },
  context: ResolvedContext,
) {
  if (owner.type === 'guest') {
    return conversationService.getOrCreateGuestConversation(owner.id, {
      relationTo: context.relationTo as any,
      value: context.value,
    })
  }

  return conversationService.getOrCreateActiveConversation(owner.id, {
    relationTo: context.relationTo as any,
    value: context.value,
  })
}
```

**Tasks**:

- [ ] Update `getOrCreateConversation` to accept owner type
- [ ] Add similar update to `validateContextAccess` if needed

---

### 4.4 Update Streaming Chat

**File**: `src/server/payload/endpoints/agent/chat-stream.ts` (modify existing)

**Pattern Reference**: See lines 1-100 for streaming handler structure.

**Key Changes**:

- Apply same guest session detection as in `chat.ts`
- Pass guest session through to pipeline

---

### 4.5 Update Get Conversation Endpoint

**File**: `src/server/payload/endpoints/agent/get-conversation.ts` (modify existing)

**Current** (line 30-40):

```typescript
const { user } = await req.payload.auth({ headers: req.headers })
if (!user) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Change to**:

```typescript
const { user } = await req.payload.auth({ headers: req.headers })

let guestSession: GuestSessionDoc | null = null
let owner: { type: 'user'; id: string } | { type: 'guest'; id: string } | null = null

if (user) {
  owner = { type: 'user', id: user.id }
} else {
  const guestToken = getGuestSessionCookie(req.headers)
  if (guestToken) {
    guestSession = await getGuestSessionByToken(guestToken)
    if (guestSession) {
      owner = { type: 'guest', id: guestSession.id }
    }
  }
}

if (!owner) {
  return Response.json({ success: false, exists: false, authRequired: true }, { status: 401 })
}
```

**Update query** (line 45-55) to check both user and guest ownership.

---

### 4.6 Update Reset Chat Endpoint

**File**: `src/server/payload/endpoints/agent/reset-chat.ts` (modify existing)

**Pattern Reference**: See lines 25-50 for reset logic.

**Key Changes**:

- Apply same guest session detection
- Call `conversationService.resetGuestConversation` for guests

### Test Gates: G4-G8 — Guest Chat Flow (Integration)

**Files**: `tests/unit/guest-session.spec.ts`, `tests/int/guest-chat.int.spec.ts`
**Enforces**: S1 (no raw tokens), S2 (cookie security), S4 (IDOR), S5 (cross-tenant), S6 (expired handling)
**Run**:

```bash
pnpm vitest run tests/int/guest-chat.int.spec.ts -t "guest sync chat"
pnpm vitest run tests/int/guest-chat.int.spec.ts -t "guest stream chat"
pnpm vitest run tests/int/guest-chat.int.spec.ts -t "IDOR"
pnpm vitest run tests/int/guest-chat.int.spec.ts -t "cross-tenant"
pnpm vitest run tests/int/guest-chat.int.spec.ts -t "expired session"
```

**Acceptance**: All tests PASS before proceeding to Phase 5.

```typescript
describe('guest sync chat (G4)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    const context = await createContextHierarchy(payload)
    testExerciseId = context.exerciseId
  })

  it('unauthenticated request creates session and conversation', async () => {
    const req = {
      payload,
      headers: new Headers(), // No auth, no guest cookie
      json: async () => ({
        message: 'Hello, I need help',
        acknowledgment: 'ack-1',
        exerciseId: testExerciseId,
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.conversationId).toBeDefined()
    expect(body.isGuestMode).toBe(true)
    expect(body.sessionExpiresAt).toBeDefined()

    // Verify Set-Cookie header was set
    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toContain('guest_session=')
    expect(setCookie).toContain('HttpOnly')

    // Verify conversation was created with guestSession
    const conversation = await payload.findByID({
      collection: 'conversations',
      id: body.conversationId,
      overrideAccess: true,
    })
    expect(conversation.guestSession).toBeDefined()
    expect(conversation.user).toBeUndefined()
  })

  it('request with valid guest cookie reuses session', async () => {
    // First create a session
    const { session, token } = await createGuestSession(payload, {})
    const conversation = await createGuestConversation(payload, {
      guestSessionId: session.id,
      contextRef: { relationTo: 'exercises', value: testExerciseId },
    })

    const req = {
      payload,
      headers: new Headers({ Cookie: `guest_session=${token}` }),
      json: async () => ({
        message: 'Continue our chat',
        acknowledgment: 'ack-2',
        conversationId: conversation.id,
        exerciseId: testExerciseId,
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.conversationId).toBe(conversation.id) // Same conversation

    // Verify session activity was extended
    const updatedSession = await payload.findByID({
      collection: 'guest-sessions',
      id: session.id,
    })
    expect(new Date(updatedSession.lastActiveAt) > new Date(session.lastActiveAt)).toBe(true)
  })
})

describe('guest stream chat (G5)', () => {
  it('streaming endpoint works with guest session', async () => {
    const { token } = await createGuestSession(payload, {})

    const req = {
      payload,
      headers: new Headers({ Cookie: `guest_session=${token}` }),
      json: async () => ({
        message: 'Stream test',
        acknowledgment: 'stream-ack',
        exerciseId: testExerciseId,
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChatStream(req)
    expect(res.status).toBe(200)

    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toContain('guest_session=')
  })
})

describe('IDOR prevention (G6)', () => {
  it('Guest A cannot access Guest B conversation', async () => {
    // Create Guest A session + conversation
    const { session: sessionA, token: tokenA } = await createGuestSession(payload, {})
    const convA = await createGuestConversation(payload, {
      guestSessionId: sessionA.id,
      contextRef: { relationTo: 'exercises', value: testExerciseId },
    })

    // Create Guest B session
    const { session: sessionB, token: tokenB } = await createGuestSession(payload, {})

    // Guest B tries to read Guest A's conversation
    const req = {
      payload,
      headers: new Headers({ Cookie: `guest_session=${tokenB}` }),
      json: async () => ({ contextKey: convA.contextKey }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentGetConversation(req)
    const body = await res.json()

    // Guest B should NOT see Guest A's conversation
    expect(body.success).toBe(true)
    expect(body.exists).toBe(false)
    expect(body.conversationId).toBeUndefined()
  })
})

describe('cross-tenant isolation (G7)', () => {
  beforeAll(async () => {
    const user = await createTestUser(payload)
    testUserId = user.id
  })

  it('user cannot read guest conversation', async () => {
    const { session: guestSession } = await createGuestSession(payload, {})
    const guestConv = await createGuestConversation(payload, {
      guestSessionId: guestSession.id,
      contextRef: { relationTo: 'exercises', value: testExerciseId },
    })

    // Authenticated user tries to read guest conversation
    const req = {
      payload,
      user: { id: testUserId } as PayloadRequest['user'],
      json: async () => ({ contextKey: guestConv.contextKey }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentGetConversation(req)
    const body = await res.json()

    // User should NOT see guest conversation
    expect(body.exists).toBe(false)
  })

  it('guest cannot read user conversation', async () => {
    const { session: guestSession } = await createGuestSession(payload, {})
    const userConv = await createConversation(payload, {
      userId: testUserId,
      contextRef: { relationTo: 'exercises', value: testExerciseId },
    })

    // Guest tries to read user's conversation
    const req = {
      payload,
      headers: new Headers({ Cookie: `guest_session=${guestSession.tokenHash}` }),
      json: async () => ({ contextKey: userConv.contextKey }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentGetConversation(req)
    const body = await res.json()

    // Guest should NOT see user's conversation
    expect(body.exists).toBe(false)
  })
})

describe('expired session handling (G8)', () => {
  it('expired session creates new session transparently', async () => {
    // Create an EXPIRED session
    const expiredSession = await createGuestSessionInDB(payload, {
      expiresAt: new Date(Date.now() - 86400000), // Yesterday
      status: 'active', // Still marked active in DB
    })

    const req = {
      payload,
      headers: new Headers({ Cookie: `guest_session=${expiredSession.token}` }),
      json: async () => ({
        message: 'Chat with expired session',
        acknowledgment: 'expired-ack',
        exerciseId: testExerciseId,
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const res = await agentChat(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)

    // New session should have been created
    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toContain('guest_session=')
    // Cookie value should be different (new token)
    expect(setCookie).not.toContain(expiredSession.token)
  })
})
```

---

## Phase 5: Client-Side API Service

**File**: `src/server/services/api/api-service.ts` (modify existing)

**Current Pattern** (lines 94-96):

```typescript
if (response.status === 401) {
  return { success: false, authRequired: true }
}
```

**Change to distinguish auth vs guest**:

```typescript
if (response.status === 401) {
  const data = await response.json().catch(() => ({}))
  return {
    success: false,
    authRequired: true,
    isGuestMode: data.isGuestMode || false,
  }
}
```

**Add new API response type**:

```typescript
export interface GuestChatApiResponse extends ChatApiResponse {
  isGuestMode?: boolean
  sessionExpiresAt?: string
}
```

**Update handlers** to return guest session info when applicable.

---

## Phase 6: Upgrade Flow (Guest → User)

### 6.1 Update Login Action

**File**: `src/app/(frontend)/login/login_authenticate-action.ts` (modify existing)

**Current** (lines 52-72):

```typescript
if (result.token) {
  const resolvedCookieStore = cookieStore ?? (await cookies())
  // ... set payload-token cookie
  return { success: true }
}
```

**Add after successful login**:

```typescript
if (result.token) {
  // ... existing payload-token cookie code

  // Claim guest conversations
  const guestToken = getGuestSessionCookie(resolvedCookieStore as any)
  if (guestToken) {
    try {
      const { headers: upgradeHeaders } = await claimGuestConversations(
        user.id, // Need to get user ID from result
        guestToken,
        new Headers(),
      )

      // Apply any Set-Cookie headers from upgrade
      const upgradeCookie = upgradeHeaders.get('Set-Cookie')
      if (upgradeCookie) {
        // Merge cookies - the guest cookie will be cleared
      }
    } catch (error) {
      logger.error({ error }, 'Failed to claim guest conversations on login')
    }
  }

  return { success: true }
}
```

**Note**: The `result` from `payload.login` should include the user ID. If not, fetch it:

```typescript
const { user: userResult } = await payload.findByID({
  collection: 'users',
  id: result.user.id, // or however the user ID is returned
})
```

---

### 6.2 Update Signup Action

**File**: `src/app/(frontend)/signup/actions/signup_createUser-action.ts` (modify existing)

**Current** (lines 80-95):

```typescript
if (token && 'token' in token && token.token) {
  cookieStore.set('payload-token', token.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })
}

return { success: true, message: 'Account created successfully', userId: user.id }
```

**Add before the return**:

```typescript
// Claim guest conversations
const guestToken = getGuestSessionCookie(cookieStore as any)
if (guestToken) {
  try {
    const { headers: upgradeHeaders } = await claimGuestConversations(
      user.id,
      guestToken,
      new Headers(),
    )
    // Cookie clearing is handled in claimGuestConversations
  } catch (error) {
    logger.error({ error }, 'Failed to claim guest conversations on signup')
  }
}
```

**Import required**:

```typescript
import { getGuestSessionCookie } from '@/server/services/guest-session'
import { claimGuestConversations } from '@/server/services/guest-session-upgrade'
```

### Test Gates: G9-G10 — Guest → User Upgrade (Integration)

**File**: `tests/int/guest-chat.int.spec.ts`
**Enforces**: S7 (Atomic upgrade: convs transfer + session revoked + cookie cleared)
**Run**:

```bash
pnpm vitest run tests/int/guest-chat.int.spec.ts -t "upgrade on login"
pnpm vitest run tests/int/guest-chat.int.spec.ts -t "upgrade on signup"
```

**Acceptance**: All tests PASS before proceeding to Phase 7.

```typescript
describe('upgrade on login (G9)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    const context = await createContextHierarchy(payload)
    testExerciseId = context.exerciseId

    // Create user for login
    const user = await createTestUser(payload, { email: 'upgrade-test@example.com' })
    testUserId = user.id
  })

  it('guest conversations transfer to user on login', async () => {
    // Create guest session + conversations
    const { session: guestSession, token: guestToken } = await createGuestSession(payload, {})
    const conv1 = await createGuestConversation(payload, {
      guestSessionId: guestSession.id,
      contextRef: { relationTo: 'exercises', value: testExerciseId },
    })
    const conv2 = await createGuestConversation(payload, {
      guestSessionId: guestSession.id,
      contextRef: { relationTo: 'exercises', value: testExerciseId }, // Different context
    })

    // Simulate login with guest cookie
    const { headers: upgradeHeaders } = await claimGuestConversations(
      testUserId,
      guestToken,
      new Headers(),
    )

    // Verify conversations are now owned by user
    const updatedConv1 = await payload.findByID({
      collection: 'conversations',
      id: conv1.id,
      overrideAccess: true,
    })
    expect(updatedConv1.user).toBe(testUserId)
    expect(updatedConv1.guestSession).toBeNull()

    const updatedConv2 = await payload.findByID({
      collection: 'conversations',
      id: conv2.id,
      overrideAccess: true,
    })
    expect(updatedConv2.user).toBe(testUserId)
    expect(updatedConv2.guestSession).toBeNull()

    // Verify session was revoked
    const revokedSession = await payload.findByID({
      collection: 'guest-sessions',
      id: guestSession.id,
    })
    expect(revokedSession.status).toBe('revoked')
    expect(revokedSession.claimedByUser).toBe(testUserId)

    // Verify cookie is cleared
    const clearCookie = upgradeHeaders.get('Set-Cookie')
    expect(clearCookie).toContain('guest_session=')
    expect(clearCookie).toContain('Max-Age=0')
  })

  it('login without guest cookie works normally', async () => {
    const { headers } = await claimGuestConversations(
      testUserId,
      'nonexistent-token',
      new Headers(),
    )
    expect(headers.get('Set-Cookie')).toBeNull()
  })
})

describe('upgrade on signup (G10)', () => {
  it('guest conversations transfer to new user on signup', async () => {
    const { session: guestSession, token: guestToken } = await createGuestSession(payload, {})
    const guestConv = await createGuestConversation(payload, {
      guestSessionId: guestSession.id,
      contextRef: { relationTo: 'exercises', value: testExerciseId },
    })

    // Simulate signup with guest cookie (new user creation)
    const newUser = await createTestUser(payload, { email: `signup-${Date.now()}@example.com` })

    const { headers } = await claimGuestConversations(newUser.id, guestToken, new Headers())

    // Verify conversation transferred
    const updatedConv = await payload.findByID({
      collection: 'conversations',
      id: guestConv.id,
      overrideAccess: true,
    })
    expect(updatedConv.user).toBe(newUser.id)
    expect(updatedConv.guestSession).toBeNull()

    // Verify session revoked
    const revokedSession = await payload.findByID({
      collection: 'guest-sessions',
      id: guestSession.id,
    })
    expect(revokedSession.status).toBe('revoked')
  })
})
```

---

## Phase 7: Cleanup Cron Job

**File**: `src/server/payload/endpoints/cron/guest-sessions-cleanup.ts`

**Pattern Reference**: See `src/server/payload/endpoints/cron/media-expiry.ts` for the cron pattern.

**Code Template**:

```typescript
/**
 * POST /api/cron/guest-sessions-cleanup
 * Cleanup endpoint for expired guest sessions and their conversations
 *
 * @fileType endpoint
 * @domain cron
 * @pattern cron-endpoint, cleanup
 */
import type { Endpoint } from 'payload'

import { withCronMiddleware, type CronResult } from './cron-middleware'
import { getPayload } from 'payload'
import config from '@payload-config'
import { logger } from '@/infra/utils/logger'

interface CleanupStats {
  sessionsDeleted: number
  conversationsDeleted: number
  errors: number
}

async function cleanupExpiredGuestSessions(
  payload: Payload,
  reqLogger: typeof logger,
): Promise<CronResult> {
  const stats: CleanupStats = {
    sessionsDeleted: 0,
    conversationsDeleted: 0,
    errors: 0,
  }

  const now = new Date().toISOString()

  // Find expired sessions (expiresAt < now AND still marked active)
  const expiredSessions = await payload.find({
    collection: 'guest-sessions',
    where: {
      and: [{ status: { equals: 'active' } }, { expiresAt: { less_than: now } }],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  reqLogger.info({ count: expiredSessions.docs.length }, 'Found expired guest sessions')

  for (const session of expiredSessions.docs) {
    try {
      // Delete conversations owned by this session
      const conversations = await payload.find({
        collection: 'conversations',
        where: {
          guestSession: { equals: session.id },
        },
        depth: 0,
        overrideAccess: true,
      })

      for (const conv of conversations.docs) {
        await payload.delete({
          collection: 'conversations',
          id: conv.id,
          overrideAccess: true,
        })
        stats.conversationsDeleted++
      }

      // Delete the session
      await payload.delete({
        collection: 'guest-sessions',
        id: session.id,
        overrideAccess: true,
      })
      stats.sessionsDeleted++

      reqLogger.info({ sessionId: session.id }, 'Deleted expired guest session and conversations')
    } catch (error) {
      stats.errors++
      reqLogger.error({ error, sessionId: session.id }, 'Failed to cleanup guest session')
    }
  }

  return {
    success: true,
    data: {
      sessionsDeleted: stats.sessionsDeleted,
      conversationsDeleted: stats.conversationsDeleted,
      errors: stats.errors,
    },
  }
}

export const guestSessionsCleanupEndpoint: Endpoint = {
  path: '/cron/guest-sessions-cleanup',
  method: 'post',
  handler: withCronMiddleware(async ({ reqLogger, payload }) => {
    return cleanupExpiredGuestSessions(payload, reqLogger)
  }),
}
```

**Register in payload.config.ts** (add to `endpoints` array around line 145):

```typescript
{
  path: '/cron/guest-sessions-cleanup',
  method: 'post',
  handler: (req: PayloadRequest) => {
    const { guestSessionsCleanupEndpoint } = await import('@/server/payload/endpoints/cron/guest-sessions-cleanup')
    return guestSessionsCleanupEndpoint.handler(req)
  },
}
```

**Tasks**:

- [ ] Create `src/server/payload/endpoints/cron/guest-sessions-cleanup.ts`
- [ ] Register endpoint in `src/payload.config.ts`
- [ ] Configure Vercel Cron to hit `/api/cron/guest-sessions-cleanup` hourly

### Test Gate: G11 — Cleanup Safety (Integration)

**File**: `tests/int/guest-chat.int.spec.ts`
**Enforces**: S8 (Cleanup deletes expired but NOT active/claimed sessions)
**Run**: `pnpm vitest run tests/int/guest-chat.int.spec.ts -t "cleanup"`
**Acceptance**: Test PASS before proceeding to Phase 8.

```typescript
describe('cleanup job safety (G11)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    testCronSecret = process.env.CRON_SECRET
    process.env.CRON_SECRET = TEST_CRON_SECRET
  })

  afterAll(() => {
    process.env.CRON_SECRET = testCronSecret
  })

  it('deletes expired sessions AND their conversations', async () => {
    const expiredSession = await createGuestSessionInDB(payload, {
      status: 'active',
      expiresAt: new Date(Date.now() - 86400000), // Yesterday
    })
    const expiredConv = await createGuestConversation(payload, {
      guestSessionId: expiredSession.session.id,
      contextRef: { relationTo: 'exercises', value: testExerciseId },
    })

    // Run cleanup
    const req = {
      payload,
      headers: new Headers({ 'x-cron-secret': TEST_CRON_SECRET }),
    } as PayloadRequest

    const res = await guestSessionsCleanupEndpoint.handler(req)
    const body = await res.json()

    expect(body.success).toBe(true)
    expect(body.data.sessionsDeleted).toBe(1)

    // Expired session should be deleted
    await expect(
      payload.findByID({
        collection: 'guest-sessions',
        id: expiredSession.session.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()

    // Expired conversation should be deleted
    await expect(
      payload.findByID({ collection: 'conversations', id: expiredConv.id, overrideAccess: true }),
    ).rejects.toThrow()
  })

  it('does NOT delete active sessions', async () => {
    const activeSession = await createGuestSessionInDB(payload, {
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000 * 7), // 7 days from now
    })

    // Run cleanup
    const req = {
      payload,
      headers: new Headers({ 'x-cron-secret': TEST_CRON_SECRET }),
    } as PayloadRequest

    const res = await guestSessionsCleanupEndpoint.handler(req)
    const body = await res.json()

    // Active session should NOT be counted in deleted
    const deletedIds = body.data.sessionsDeleted || 0

    // Verify active session still exists
    const stillActive = await payload.findByID({
      collection: 'guest-sessions',
      id: activeSession.session.id,
      overrideAccess: true,
    })
    expect(stillActive).toBeDefined()
    expect(stillActive.status).toBe('active')
  })

  it('does NOT delete claimed sessions', async () => {
    const claimedSession = await createGuestSessionInDB(payload, {
      status: 'revoked',
      claimedByUser: testUserId,
      expiresAt: new Date(Date.now() - 86400000), // Expired but claimed
    })

    // Run cleanup
    const req = {
      payload,
      headers: new Headers({ 'x-cron-secret': TEST_CRON_SECRET }),
    } as PayloadRequest

    const res = await guestSessionsCleanupEndpoint.handler(req)
    const body = await res.json()

    // Claimed session should NOT be deleted
    const claimed = await payload.findByID({
      collection: 'guest-sessions',
      id: claimedSession.session.id,
      overrideAccess: true,
    })
    expect(claimed).toBeDefined()
    expect(claimed.status).toBe('revoked')
  })
})
```

---

## Phase 8: Frontend Integration

### 8.1 Update ChatErrorSurface

**File**: `src/ui/web/chat/ChatErrorSurface/index.tsx` (modify existing)

**Current** (lines 40-56):

```typescript
{type === 'auth' && (
  <div className="flex items-center gap-2 mt-2 text-sm">
    <SystemLink href={loginUrl} className="font-semibold underline">
      {tCourses('chatAuthRequiredLogin')}
    </SystemLink>
    <span className="text-destructive/60">or</span>
    <SystemLink href={signupUrl} className="font-semibold underline">
      {tCourses('chatAuthRequiredCTA')}
    </SystemLink>
  </div>
)}
```

**Add guest mode**:

```typescript
{type === 'auth' && !isGuestMode && (
  <div className="flex items-center gap-2 mt-2 text-sm">
    <SystemLink href={loginUrl} className="font-semibold underline">
      {tCourses('chatAuthRequiredLogin')}
    </SystemLink>
    <span className="text-destructive/60">or</span>
    <SystemLink href={signupUrl} className="font-semibold underline">
      {tCourses('chatAuthRequiredCTA')}
    </SystemLink>
  </div>
)}

{isGuestMode && (
  <div className="flex items-center gap-2 mt-2 text-sm">
    <span className="text-muted-foreground">
      Continue chatting after{' '}
    </span>
    <SystemLink href={loginUrl} className="font-semibold underline">
      logging in
    </SystemLink>
    <span className="text-muted-foreground">or</span>
    <SystemLink href={signupUrl} className="font-semibold underline">
      signing up
    </SystemLink>
  </div>
)}
```

**Add new props**:

```typescript
export interface ChatErrorSurfaceProps {
  type: 'auth' | 'general'
  message: string
  onDismiss: () => void
  className?: string
  isGuestMode?: boolean // NEW
}
```

---

### 8.2 Update useNotebookChat Hook

**File**: `src/ui/web/chat/hooks/useNotebookChat.ts` (modify existing)

**Pattern Reference**: See lines 200-250 for auth error handling.

**Key Changes**:

1. Add `isGuestMode` state variable
2. Update auth error handling to detect guest mode:

```typescript
if (response.status === 401) {
  const data = await response.json().catch(() => ({}))
  setIsGuestMode(data.isGuestMode || false)
  setError({
    type: 'auth',
    message: data.isGuestMode
      ? 'Sign in to save your chat history'
      : 'Please log in to continue chatting',
  })
  return
}
```

3. Add UI indication for guest mode (badge, expiry warning)

---

## Phase 9: Rate Limiting

**File**: `src/server/services/rate-limit.ts`

**Pattern Reference**: See `src/app/(frontend)/signup/actions/signup_rateLimit-action.ts` for existing rate limiting pattern.

**Code Template**:

```typescript
/**
 * Rate Limiting for Guest Chat
 * Simple in-memory rate limiting with configurable limits
 */
import { logger } from '@/infra/utils/logger'

// In-memory store (replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export const GUEST_CHAT_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute for guests
}

export const SESSION_CREATION_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxPerIP: 5, // 5 new sessions per IP per hour
}

export function checkRateLimit(
  key: string,
  limit: typeof GUEST_CHAT_RATE_LIMIT,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const existing = rateLimitStore.get(key)

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + limit.windowMs,
    })
    return { allowed: true, remaining: limit.maxRequests - 1, resetAt: now + limit.windowMs }
  }

  if (existing.count >= limit.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count++
  return { allowed: true, remaining: limit.maxRequests - existing.count, resetAt: existing.resetAt }
}

export function getRateLimitHeaders(result: {
  allowed: boolean
  remaining: number
  resetAt: number
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(GUEST_CHAT_RATE_LIMIT.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed
      ? {}
      : { 'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)) }),
  }
}
```

**Use in chat endpoints**:

```typescript
// In chat.ts handler, before processing
const clientIP = req.headers?.get('x-forwarded-for') || 'unknown'
const rateLimit = checkRateLimit(clientIP, GUEST_CHAT_RATE_LIMIT)

if (!rateLimit.allowed) {
  return Response.json(
    {
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
    },
    { status: 429, headers: getRateLimitHeaders(rateLimit) },
  )
}
```

### Test Gate: G12 — Rate Limiting (Integration)

**File**: `tests/int/guest-chat.int.spec.ts`
**Enforces**: Rate limit enforcement (10 requests/minute for guests)
**Run**: `pnpm vitest run tests/int/guest-chat.int.spec.ts -t "rate limit"`
**Acceptance**: Test PASS before proceeding to Phase 10.

```typescript
describe('rate limiting (G12)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    const context = await createContextHierarchy(payload)
    testExerciseId = context.exerciseId
  })

  it('allows 10 requests, rejects 11th with 429', async () => {
    const clientIP = `test-ip-${Date.now()}-${Math.random()}`

    // Make 10 requests (should all succeed)
    for (let i = 0; i < 10; i++) {
      const req = {
        payload,
        headers: new Headers(),
        json: async () => ({
          message: `Rate limit test ${i}`,
          acknowledgment: `ack-${i}`,
          exerciseId: testExerciseId,
        }),
      } as PayloadRequest & { json: () => Promise<unknown> }

      // Inject client IP for rate limiting
      const reqWithIP = {
        ...req,
        headers: new Headers([...req.headers.entries(), ['x-forwarded-for', clientIP]]),
      }

      const res = await agentChat(reqWithIP)
      expect(res.status).toBeLessThan(429) // 200 or other non-429
    }

    // 11th request should be rate limited
    const rateLimitedReq = {
      payload,
      headers: new Headers(),
      json: async () => ({
        message: 'This should be rate limited',
        acknowledgment: 'ack-11',
        exerciseId: testExerciseId,
      }),
    } as PayloadRequest & { json: () => Promise<unknown> }

    const rateLimitedReqWithIP = {
      ...rateLimitedReq,
      headers: new Headers([...rateLimitedReq.headers.entries(), ['x-forwarded-for', clientIP]]),
    }

    const res = await agentChat(rateLimitedReqWithIP)
    expect(res.status).toBe(429)

    const body = await res.json()
    expect(body.error).toContain('Rate limit')
    expect(res.headers.get('Retry-After')).toBeDefined()
  })
})
```

---

## Phase 10: Testing

### 10.1 Test Files Created

| File                                       | Gates  | What it Tests                                                                                             |
| ------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------- |
| `tests/unit/guest-session.spec.ts`         | G1, G2 | Token hashing, cookie management                                                                          |
| `tests/int/guest-chat.int.spec.ts`         | G3-G12 | All integration tests (owner constraint, guest chat, IDOR, cross-tenant, upgrade, cleanup, rate limiting) |
| `tests/factories/guest-session.factory.ts` | -      | Test factory for creating guest sessions                                                                  |

### 10.2 Running Test Gates

```bash
# Run all gates sequentially (recommended)
pnpm vitest run tests/unit/guest-session.spec.ts
pnpm vitest run tests/int/guest-chat.int.spec.ts

# Run specific gate
pnpm vitest run tests/int/guest-chat.int.spec.ts -t "IDOR"

# Run with MongoDB container
pnpm vitest run tests/int/guest-chat.int.spec.ts --reporter=verbose
```

### 10.3 Test Gate Status

| Gate                       | Status     | Notes   |
| -------------------------- | ---------- | ------- |
| G1: Token hashing          | ⏳ Pending | Phase 2 |
| G2: Cookie management      | ⏳ Pending | Phase 2 |
| G3: Exactly-one-owner      | ⏳ Pending | Phase 3 |
| G4: Guest sync chat        | ⏳ Pending | Phase 4 |
| G5: Guest stream chat      | ⏳ Pending | Phase 4 |
| G6: IDOR prevention        | ⏳ Pending | Phase 4 |
| G7: Cross-tenant isolation | ⏳ Pending | Phase 4 |
| G8: Expired session        | ⏳ Pending | Phase 4 |
| G9: Upgrade on login       | ⏳ Pending | Phase 6 |
| G10: Upgrade on signup     | ⏳ Pending | Phase 6 |
| G11: Cleanup safety        | ⏳ Pending | Phase 7 |
| G12: Rate limiting         | ⏳ Pending | Phase 9 |

---

## Rollout Checklist

### Pre-Launch (Gates G1-G12)

- [ ] All phases 1-9 complete
- [ ] **G1** (`hashToken`, `verifyTokenHash`): PASS
- [ ] **G2** (`setGuestSessionCookie`, `getGuestSessionCookie`, `clearGuestSessionCookie`): PASS
- [ ] **G3** (exactly-one-owner constraint): PASS
- [ ] **G4** (guest sync chat flow): PASS
- [ ] **G5** (guest stream chat flow): PASS
- [ ] **G6** (IDOR prevention): PASS
- [ ] **G7** (cross-tenant isolation): PASS
- [ ] **G8** (expired session handling): PASS
- [ ] **G9** (upgrade on login): PASS
- [ ] **G10** (upgrade on signup): PASS
- [ ] **G11** (cleanup safety): PASS
- [ ] **G12** (rate limiting): PASS
- [ ] `pnpm generate:types` runs successfully
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes

### Phase 1: Enable Guest Sessions (Behind Feature Flag)

- [ ] Deploy with guest sessions enabled but chat endpoint unchanged
- [ ] Verify session creation works
- [ ] Verify cleanup job runs (dry run mode)
- [ ] Monitor session creation rate

### Phase 2: Enable Guest Chat

- [ ] Update chat endpoint to accept guest sessions
- [ ] Test anonymous chat flow
- [ ] Verify session persistence
- [ ] Monitor abuse signals

### Phase 3: Enable Upgrade Flow

- [ ] Update login action to claim conversations
- [ ] Update signup action to claim conversations
- [ ] Test guest → register flow
- [ ] Test guest → login flow
- [ ] Monitor upgrade success rate

### Phase 4: Enable Cleanup

- [ ] Enable destructive cleanup
- [ ] Verify orphaned conversations are deleted
- [ ] Tune rate limits based on data

---

## Architecture Summary

### Data Flow: Anonymous Chat

```
1. User visits → no payload-token cookie
2. Server detects → creates GuestSession → sets guest_session cookie
3. User chats → cookie sent with request → session validated
4. Conversation created with guestSession relationship
5. Session activity extends sliding TTL
```

### Data Flow: Guest → User Upgrade

```
1. Guest logs in/registers
2. Server action checks for guest_session cookie
3. Finds all conversations with guestSession = session.id
4. Updates each: user = newUser.id, guestSession = null
5. Revokes guest session, clears cookie
```

---

## Key Files Reference

| Purpose               | File                                                            |
| --------------------- | --------------------------------------------------------------- |
| Collection schema     | `src/server/payload/collections/GuestSessions.ts`               |
| Session service       | `src/server/services/guest-session.ts`                          |
| Upgrade service       | `src/server/services/guest-session-upgrade.ts`                  |
| Conversation service  | `src/server/services/conversation-service.ts`                   |
| Chat handler          | `src/server/payload/endpoints/agent/chat.ts`                    |
| Chat pipeline         | `src/server/payload/endpoints/agent/chat/pipeline.ts`           |
| Context resolution    | `src/server/payload/endpoints/agent/chat/context-resolution.ts` |
| Streaming chat        | `src/server/payload/endpoints/agent/chat-stream.ts`             |
| Get conversation      | `src/server/payload/endpoints/agent/get-conversation.ts`        |
| Reset chat            | `src/server/payload/endpoints/agent/reset-chat.ts`              |
| Client API            | `src/server/services/api/api-service.ts`                        |
| Login action          | `src/app/(frontend)/login/login_authenticate-action.ts`         |
| Signup action         | `src/app/(frontend)/signup/actions/signup_createUser-action.ts` |
| Cleanup cron          | `src/server/payload/endpoints/cron/guest-sessions-cleanup.ts`   |
| Chat UI               | `src/ui/web/chat/ChatInterface/index.tsx`                       |
| Chat hook             | `src/ui/web/chat/hooks/useNotebookChat.ts`                      |
| Error UI              | `src/ui/web/chat/ChatErrorSurface/index.tsx`                    |
| Payload config        | `src/payload.config.ts`                                         |
| **Test Factory**      | `tests/factories/guest-session.factory.ts`                      |
| **Unit Tests**        | `tests/unit/guest-session.spec.ts` (G1, G2)                     |
| **Integration Tests** | `tests/int/guest-chat.int.spec.ts` (G3-G12)                     |
