# Registration Flow Implementation Plan

## Overview

Implement registration with **Email/Password + Google OAuth only**.

---

## Auth Stack Decision

**Chosen Stack**: Payload CMS built-in authentication

**Login Identifier**: **`email`** (confirmed from `src/collections/Users/index.ts` and existing login UI/actions)

Decision based on current reality: there is no `username` field or username-based login in the codebase today. If product requires username login, the plan must be revised to add a username field, unique index/validation, and update signup/login actions plus `getMeUser()` usage accordingly.

**Rationale**:
- Existing email/password signup already uses `payload.login()` with full session management
- Payload provides `payload.login()` that returns a JWT token when authentication succeeds
- OAuth users will be created with random passwords and authenticated using Payload's session system
- No need for external auth libraries (NextAuth, Auth.js, etc.)

**Session Creation After OAuth**:
1. User authenticates with Google
2. Backend creates or finds user in Payload `users` collection
3. **New users**: Create with random password - use `payload.login()` with known password
4. **Existing users**:
   - If Google identity is linked AND `localAuthEnabled=false` (OAuth-only): rotate password server-side and use `payload.login()` immediately.
   - If user exists by email but has no Google identity OR `localAuthEnabled=true`: do NOT auto-link; redirect to `/login?error=account_exists&returnTo=...`
5. Extract JWT token from the response
6. Set `${payload.config.cookiePrefix}-token` cookie (HTTP-only, secure) following existing patterns in `login_authenticate-action.ts`

**Critical Decisions**:
- Never reset passwords for existing email/password users when linking OAuth
- Use only documented Payload APIs (`payload.login()`, not `payload.db.generateToken()`)
- Existing users must manually log in before any account linking
- Email/password signup remains enabled (Google is an additional option)
- If account exists for Google email, do NOT auto-link in callback (manual login required)
- No passwordless session issuance in Payload 3.70.0 (no documented API)
- Allow password rotation ONLY for OAuth-only accounts (`localAuthEnabled=false`)

**Authoritative Token**: `${payload.config.cookiePrefix}-token` cookie (JWT signed by Payload)
- Same cookie name/prefix as existing email/password flow
- Verified by Payload's `/api/users/me` endpoint
- Server-side verification via `getMeUser()` utility (calls `/api/users/me` with JWT)

---

## Current State Analysis

### Existing User Collection
**File**: [src/collections/Users/index.ts](src/collections/Users/index.ts)

Current fields:
- `name` (text)
- `email` (auth - built-in)
- `password` (auth - built-in)
- `role` (select: admin/student)

Current hooks:
- `ensureRoleOnSignup` - Forces student role on signup
- `preventLastAdminDemotion` - Prevents last admin from being demoted
- `auditRoleChange` - Audit trail for role changes

### Existing Auth Flow
**Files**:
- [src/app/(frontend)/signup/](src/app/(frontend)/signup/) - Signup page and components
- [src/app/(frontend)/login/](src/app/(frontend)/login/) - Login page and components
- [src/utilities/getMeUser.ts](src/utilities/getMeUser.ts) - Server-side user fetch with JWT verification

**Current email/password flow** (email is the login identifier):
1. User submits email/password
2. `payload.login()` authenticates and returns JWT token
3. Set `${payload.config.cookiePrefix}-token` cookie
4. Auto-login - redirect to home
5. Login page must preserve and consume `returnTo` after successful password login

**Server-side user verification**:
- `getMeUser()` utility fetches current user via `/api/users/me` endpoint
- Verifies JWT signature server-side (no jwt-decode)
- Returns `{ user, token }` or redirects if invalid

### Middleware
**File**: [middleware.ts](middleware.ts)

Currently handles locale detection only. No auth guards.

---

## Stage 1: Google OAuth Implementation

### 1.1 User Schema Updates

**File**: [src/collections/Users/index.ts](src/collections/Users/index.ts)

Add the following fields:

```typescript
// Registration method - how user first registered (metadata only)
{
  name: 'registrationMethod',
  type: 'select',
  options: [
    { label: 'Email', value: 'email' },
    { label: 'Google', value: 'google' },
  ],
  required: false,
  admin: { position: 'sidebar', readOnly: true },
},

// Local password auth enabled (guards password rotation for OAuth-only accounts)
{
  name: 'localAuthEnabled',
  type: 'checkbox',
  defaultValue: true,
  admin: { position: 'sidebar', readOnly: true },
},

// Registration timestamp
{
  name: 'registeredAt',
  type: 'date',
  admin: { readOnly: true, position: 'sidebar' },
},

// ═══════════════════════════════════════════════════════════════════
// TOP-LEVEL GOOGLE FIELDS (for reliable lookups)
// ═══════════════════════════════════════════════════════════════════
// Payload v3 array-of-objects queries may not work reliably.
// Use these top-level fields for lookups; keep oauthIdentities for future providers.

{
  name: 'googleSub',
  type: 'text',
  unique: true,
  index: true,
  admin: { readOnly: true, position: 'sidebar' },
  // Sparse index: only indexed when value exists
  // Enforced via hook or DB-level sparse index
},

{
  name: 'googleEmail',
  type: 'email',
  index: true,
  admin: { readOnly: true, position: 'sidebar' },
},

// Password version for OAuth-only users (guards concurrent callback race)
{
  name: 'oauthPasswordVersion',
  type: 'number',
  defaultValue: 0,
  admin: { readOnly: true, hidden: true },
},

// OAuth identities (provider-agnostic, for profile data and future providers)
{
  name: 'oauthIdentities',
  type: 'array',
  admin: { readOnly: true },
  fields: [
    {
      name: 'provider',
      type: 'select',
      options: [{ label: 'Google', value: 'google' }],
      required: true,
    },
    {
      name: 'providerUserId',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'linkedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'profile',
      type: 'json',
      admin: { hidden: true },
    },
  ],
},
```

Note: Stage 1 does not add verification fields. Use `email` as the login identifier and `registrationMethod` + `registeredAt` for the registration gate.

> **Query Validation Note**: Before implementation, verify array queries work via a test script:
> ```typescript
> const result = await payload.find({
>   collection: 'users',
>   where: { 'oauthIdentities.provider': { equals: 'google' } },
> })
> ```
> If this returns no results for known data, fallback to top-level `googleSub` / `googleEmail` fields is mandatory. The plan assumes fallback is used.

### 1.2 Environment Variables

**File**: `.env` (add)

```env
# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
```

Optional (client UI only):
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 1.3 Dependencies

**File**: `package.json` (add)

```json
{
  "dependencies": {
    "arctic": "^3.5.0"
  }
}
```

Using `arctic` library for OAuth - lightweight, TypeScript-native, no external dependencies.

### 1.4 OAuth Library Setup

**Create**: `src/lib/auth/google-oauth.ts`

```typescript
import { Google } from 'arctic'

export function createGoogleOAuth() {
  return new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth/google/callback`
  )
}

export interface GoogleUserInfo {
  sub: string           // Google user ID
  email: string
  email_verified: boolean
  name: string
  picture?: string
  locale?: string
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Failed to fetch Google user info')
  return response.json()
}
```

### 1.5 OAuth Cookie Management (Single Source of Truth)

**Create**: `src/lib/auth/oauth-cookies.ts`

```typescript
import type { NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH FOR OAUTH COOKIES
// ═══════════════════════════════════════════════════════════════════

export const STATE_COOKIE = 'oauth_state'
export const RETURN_TO_COOKIE = 'oauth_return_to'
export const MODE_COOKIE = 'oauth_mode'
export const CODE_VERIFIER_COOKIE = 'oauth_code_verifier'

interface OAuthCookieOptions {
  state: string
  returnTo: string
  mode: 'login' | 'link'
  codeVerifier: string
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 10, // 10 minutes
  path: '/',
}

/**
 * Set all OAuth cookies on the response (single entry point)
 */
export function setOAuthCookies(response: NextResponse, options: OAuthCookieOptions): void {
  response.cookies.set(STATE_COOKIE, options.state, COOKIE_OPTIONS)
  response.cookies.set(RETURN_TO_COOKIE, options.returnTo, COOKIE_OPTIONS)
  response.cookies.set(MODE_COOKIE, options.mode, COOKIE_OPTIONS)
  response.cookies.set(CODE_VERIFIER_COOKIE, options.codeVerifier, COOKIE_OPTIONS)
}

/**
 * Delete all OAuth cookies on the response (MUST be called on every callback return)
 */
export function cleanupOAuthCookies(response: NextResponse): void {
  response.cookies.delete(STATE_COOKIE)
  response.cookies.delete(RETURN_TO_COOKIE)
  response.cookies.delete(MODE_COOKIE)
  response.cookies.delete(CODE_VERIFIER_COOKIE)
}
```

**Create**: `src/lib/auth/oauth-state.ts`

```typescript
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { STATE_COOKIE, RETURN_TO_COOKIE, MODE_COOKIE } from './oauth-cookies'

/**
 * Generate a cryptographically secure state token
 */
export function createOAuthState(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Verify state matches cookie and return stored metadata
 * NOTE: This only reads cookies; setting/deleting is done via oauth-cookies.ts
 */
export async function verifyOAuthState(
  state: string
): Promise<{ valid: boolean; returnTo?: string; mode?: 'login' | 'link' }> {
  const cookieStore = await cookies()
  const storedState = cookieStore.get(STATE_COOKIE)?.value
  const returnTo = cookieStore.get(RETURN_TO_COOKIE)?.value
  const mode = cookieStore.get(MODE_COOKIE)?.value === 'link' ? 'link' : 'login'

  return {
    valid: storedState === state,
    returnTo,
    mode,
  }
}
```

Note: OAuth cookies are set via `setOAuthCookies()` and deleted via `cleanupOAuthCookies()` on the `NextResponse` in route handlers. Never set cookies individually.

### 1.6 OAuth API Routes

**Create**: `src/app/api/auth/google/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { generateCodeVerifier } from 'arctic'
import { createGoogleOAuth } from '@/lib/auth/google-oauth'
import { createOAuthState } from '@/lib/auth/oauth-state'
import { setOAuthCookies } from '@/lib/auth/oauth-cookies'

export async function GET(request: NextRequest) {
  const sanitizeReturnTo = (value?: string | null) => {
    if (!value) return '/'
    if (!value.startsWith('/')) return '/'
    if (value.startsWith('//')) return '/'
    return value
  }

  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  const mode = request.nextUrl.searchParams.get('mode') === 'link' ? 'link' : 'login'

  const google = createGoogleOAuth()
  const state = createOAuthState()
  const codeVerifier = generateCodeVerifier()

  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile'])

  const response = NextResponse.redirect(url)

  // Single call to set all OAuth cookies
  setOAuthCookies(response, { state, returnTo, mode, codeVerifier })

  return response
}
```

**Create**: `src/app/api/auth/google/callback/route.ts`

**CRITICAL SECURITY NOTES**:
1. **NEVER** reset passwords for existing email/password users
2. Use `payload.login()` only for new OAuth users where we set the password
3. Existing users:
   - OAuth-only (localAuthEnabled=false) with linked Google identity: rotate password + login with guard/retry
   - Otherwise: do NOT auto-link and do NOT log in
4. Delete OAuth cookies via `cleanupOAuthCookies()` on ALL callback responses (success and error)
5. Use `googleSub` top-level field for lookups (not array queries)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { createGoogleOAuth, getGoogleUserInfo } from '@/lib/auth/google-oauth'
import { verifyOAuthState } from '@/lib/auth/oauth-state'
import { CODE_VERIFIER_COOKIE, cleanupOAuthCookies } from '@/lib/auth/oauth-cookies'
import { getMeUser } from '@/utilities/getMeUser'
import { AccountRole } from '@/collections/Users/roles'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const sanitizeReturnTo = (value?: string | null) => {
    if (!value) return '/'
    if (!value.startsWith('/')) return '/'
    if (value.startsWith('//')) return '/'
    return value
  }

  // ─────────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ─────────────────────────────────────────────────────────────────
  if (error) {
    console.error('Google OAuth error:', error)
    const response = NextResponse.redirect(new URL('/signup?error=oauth_failed', request.url))
    cleanupOAuthCookies(response)
    return response
  }

  if (!code || !state) {
    const response = NextResponse.redirect(new URL('/signup?error=invalid_request', request.url))
    cleanupOAuthCookies(response)
    return response
  }

  // ─────────────────────────────────────────────────────────────────
  // STATE VERIFICATION (CSRF)
  // ─────────────────────────────────────────────────────────────────
  const { valid, returnTo, mode } = await verifyOAuthState(state)
  if (!valid) {
    const response = NextResponse.redirect(new URL('/signup?error=invalid_state', request.url))
    cleanupOAuthCookies(response)
    return response
  }

  const cookieStore = await cookies()
  const codeVerifier = cookieStore.get(CODE_VERIFIER_COOKIE)?.value

  if (!codeVerifier) {
    const response = NextResponse.redirect(new URL('/signup?error=invalid_request', request.url))
    cleanupOAuthCookies(response)
    return response
  }

  try {
    // ─────────────────────────────────────────────────────────────────
    // TOKEN EXCHANGE
    // ─────────────────────────────────────────────────────────────────
    const google = createGoogleOAuth()
    const tokens = await google.validateAuthorizationCode(code, codeVerifier)
    const googleUser = await getGoogleUserInfo(tokens.accessToken())

    if (!googleUser.email_verified) {
      const response = NextResponse.redirect(new URL('/signup?error=email_not_verified', request.url))
      cleanupOAuthCookies(response)
      return response
    }

    const payload = await getPayload({ config })
    const normalizedEmail = googleUser.email.toLowerCase().trim()
    const safeReturnTo = sanitizeReturnTo(returnTo)

    // ─────────────────────────────────────────────────────────────────
    // USER LOOKUP (googleSub → email fallback)
    // Uses top-level fields for reliable queries
    // ─────────────────────────────────────────────────────────────────
    let existingUser = await payload.find({
      collection: 'users',
      where: { googleSub: { equals: googleUser.sub } },
      limit: 1,
    }).then(res => res.docs[0])

    if (!existingUser) {
      existingUser = await payload.find({
        collection: 'users',
        where: { email: { equals: normalizedEmail } },
        limit: 1,
      }).then(res => res.docs[0])
    }

    // ─────────────────────────────────────────────────────────────────
    // LINK MODE
    // ─────────────────────────────────────────────────────────────────
    if (mode === 'link') {
      const { user } = await getMeUser()
      if (!user) {
        const response = NextResponse.redirect(
          new URL('/login?error=account_exists&returnTo=' + encodeURIComponent(safeReturnTo), request.url)
        )
        cleanupOAuthCookies(response)
        return response
      }

      // Check if googleSub is already attached to ANOTHER user
      const alreadyLinked = await payload.find({
        collection: 'users',
        where: {
          and: [
            { id: { not_equals: user.id } },
            { googleSub: { equals: googleUser.sub } },
          ],
        },
        limit: 1,
      }).then(res => res.docs[0])

      if (alreadyLinked) {
        const response = NextResponse.redirect(
          new URL('/login?error=oauth_already_linked&returnTo=' + encodeURIComponent(safeReturnTo), request.url)
        )
        cleanupOAuthCookies(response)
        return response
      }

      // Link Google identity
      const alreadyOnUser = user.googleSub === googleUser.sub
      if (!alreadyOnUser) {
        await payload.update({
          collection: 'users',
          id: user.id,
          data: {
            googleSub: googleUser.sub,
            googleEmail: normalizedEmail,
            oauthIdentities: [
              ...(user.oauthIdentities || []),
              {
                provider: 'google',
                providerUserId: googleUser.sub,
                email: normalizedEmail,
                linkedAt: new Date().toISOString(),
                profile: {
                  picture: googleUser.picture,
                  locale: googleUser.locale,
                  email_verified: googleUser.email_verified,
                },
              },
            ],
          },
        })
      }

      const response = NextResponse.redirect(new URL(safeReturnTo + '?success=google_linked', request.url))
      cleanupOAuthCookies(response)
      return response
    }

    // ─────────────────────────────────────────────────────────────────
    // EXISTING USER (LOGIN MODE)
    // ─────────────────────────────────────────────────────────────────
    if (existingUser) {
      const hasGoogleIdentity = existingUser.googleSub === googleUser.sub

      if (hasGoogleIdentity && existingUser.localAuthEnabled === false) {
        // ═══════════════════════════════════════════════════════════
        // OAUTH-ONLY LOGIN WITH GUARD + RETRY
        // Handles concurrent callback race condition
        // ═══════════════════════════════════════════════════════════
        const currentVersion = existingUser.oauthPasswordVersion ?? 0
        const rotatedPassword = crypto.randomUUID() + crypto.randomUUID()

        await payload.update({
          collection: 'users',
          id: existingUser.id,
          data: {
            password: rotatedPassword,
            oauthPasswordVersion: currentVersion + 1,
          },
        })

        let loginResult
        try {
          loginResult = await payload.login({
            collection: 'users',
            data: { email: existingUser.email, password: rotatedPassword },
          })
        } catch {
          // Retry once: re-fetch user and use latest password version
          const refreshedUser = await payload.findByID({
            collection: 'users',
            id: existingUser.id,
          })

          // If version changed, another callback won; re-rotate
          if (refreshedUser.oauthPasswordVersion !== currentVersion + 1) {
            const retryPassword = crypto.randomUUID() + crypto.randomUUID()
            await payload.update({
              collection: 'users',
              id: existingUser.id,
              data: {
                password: retryPassword,
                oauthPasswordVersion: (refreshedUser.oauthPasswordVersion ?? 0) + 1,
              },
            })
            loginResult = await payload.login({
              collection: 'users',
              data: { email: existingUser.email, password: retryPassword },
            })
          } else {
            throw new Error('OAuth login retry failed')
          }
        }

        if (!loginResult?.token) {
          throw new Error('Failed to generate auth token')
        }

        const cookiePrefix = payload.config.cookiePrefix || 'payload'
        const cookieName = `${cookiePrefix}-token`

        const response = NextResponse.redirect(new URL(safeReturnTo, request.url))
        response.cookies.set(cookieName, loginResult.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        })
        cleanupOAuthCookies(response)
        return response
      }

      // User exists but no linked identity OR localAuthEnabled=true → manual login required
      const response = NextResponse.redirect(
        new URL('/login?error=account_exists&returnTo=' + encodeURIComponent(safeReturnTo), request.url)
      )
      cleanupOAuthCookies(response)
      return response
    }

    // ─────────────────────────────────────────────────────────────────
    // NEW USER
    // ─────────────────────────────────────────────────────────────────
    const randomPassword = crypto.randomUUID() + crypto.randomUUID()

    const newUser = await payload.create({
      collection: 'users',
      data: {
        email: normalizedEmail,
        name: googleUser.name || 'Student',
        role: AccountRole.Student,
        registrationMethod: 'google',
        registeredAt: new Date().toISOString(),
        localAuthEnabled: false,
        googleSub: googleUser.sub,
        googleEmail: normalizedEmail,
        oauthPasswordVersion: 1,
        oauthIdentities: [
          {
            provider: 'google',
            providerUserId: googleUser.sub,
            email: normalizedEmail,
            linkedAt: new Date().toISOString(),
            profile: {
              picture: googleUser.picture,
              locale: googleUser.locale,
              email_verified: googleUser.email_verified,
            },
          },
        ],
        password: randomPassword,
      },
    })

    const loginResult = await payload.login({
      collection: 'users',
      data: { email: newUser.email, password: randomPassword },
    })

    if (!loginResult.token) {
      throw new Error('Failed to generate auth token')
    }

    const cookiePrefix = payload.config.cookiePrefix || 'payload'
    const cookieName = `${cookiePrefix}-token`

    const response = NextResponse.redirect(new URL(safeReturnTo, request.url))
    response.cookies.set(cookieName, loginResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    cleanupOAuthCookies(response)
    return response

  } catch (error) {
    console.error('Google OAuth callback error:', error)
    const response = NextResponse.redirect(new URL('/signup?error=oauth_failed', request.url))
    cleanupOAuthCookies(response)
    return response
  }
}
```

### 1.6b Account Linking Flow (Post-login)

**Behavior**:
- OAuth start can be called with `mode=link`.
- Callback in link mode requires an authenticated user (`getMeUser()`).
- If not authenticated, redirect to `/login?error=account_exists&returnTo=...`.
- **CRITICAL**: Before linking, check `googleSub` uniqueness against ALL other users (strict).
- If `googleSub` already linked to another user, redirect with `error=oauth_already_linked`.
- If authenticated and unique, set `googleSub`, `googleEmail`, and append to `oauthIdentities` (idempotent), do NOT change password.
- Redirect to `returnTo` with `success=google_linked`.

**URL**:
- `/api/auth/google?mode=link&returnTo=...`

### 1.7 Google Signup Button Component

**Create**: `src/app/(frontend)/signup/GoogleSignupButton.tsx`

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { useSearchParams } from 'next/navigation'

interface GoogleSignupButtonProps {
  label?: string
  className?: string
}

export function GoogleSignupButton({
  label = 'Continue with Google',
  className
}: GoogleSignupButtonProps) {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/'

  const handleClick = () => {
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={handleClick}
    >
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
        {/* Google icon SVG */}
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      {label}
    </Button>
  )
}
```

### 1.8 Update Signup Form

**Update**: [src/app/(frontend)/signup/SignupForm.tsx](src/app/(frontend)/signup/SignupForm.tsx)

Add OAuth button above the form:

```typescript
import { GoogleSignupButton } from './GoogleSignupButton'

// In the return statement, add:
<Card>
  <CardHeader>
    <p className="text-sm text-muted-foreground text-center">
      {t('signupDescription')}
    </p>
  </CardHeader>
  <CardContent>
    {/* OAuth Options */}
    <div className="space-y-3">
      <GoogleSignupButton
        label={t('continueWithGoogle')}
        className="w-full"
      />
    </div>

    {/* Divider */}
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="bg-background px-2 text-muted-foreground">
          {t('orContinueWith')}
        </span>
      </div>
    </div>

    {/* Email/Password Form */}
    <form onSubmit={onSubmit} className="space-y-4">
      {/* ... existing form fields ... */}
    </form>
  </CardContent>
</Card>
```

### 1.9 Registration Gate (Server-Side)

**IMPORTANT**: Do NOT call `getMeUser()` in Edge middleware - it uses Node.js/Payload internals not supported in Edge runtime.

**Update**: [middleware.ts](middleware.ts)

Keep middleware for locale handling only:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Only handle locale detection
  return handleLocale(request)
}
```

**Create**: `src/lib/auth/registration-gate.ts`

Server-side registration gate utility:

```typescript
import { getMeUser } from '@/utilities/getMeUser'
import { redirect } from 'next/navigation'

/**
 * Server-side registration gate
 * Call this in Server Components, Server Actions, or Route Handlers
 * DO NOT call in Edge middleware
 */
export async function requireRegistration(returnTo?: string) {
  const { user } = await getMeUser()

  if (!user) {
    // No valid session - redirect to signup
    const destination = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'
    redirect(destination)
  }

  // CORRECT: Registration is based on completion of signup flow
  const isRegistered = Boolean(user.registrationMethod && user.registeredAt)

  if (!isRegistered) {
    const destination = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'
    redirect(destination)
  }

  return user
}
```

**Update**: Protected route layouts (e.g., `src/app/(frontend)/dashboard/layout.tsx`)

```typescript
import { requireRegistration } from '@/lib/auth/registration-gate'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // CORRECT: Server-side verification in layout
  await requireRegistration('/dashboard')

  return <div>{children}</div>
}
```

**Alternative**: Protected route pages

```typescript
// src/app/(frontend)/courses/page.tsx
import { requireRegistration } from '@/lib/auth/registration-gate'

export default async function CoursesPage() {
  const user = await requireRegistration('/courses')

  return <div>Welcome, {user.name}!</div>
}
```

### 1.10 Update Signup Server Action

**Update**: [src/app/(frontend)/signup/actions/signup_createUser-action.ts](src/app/(frontend)/signup/actions/signup_createUser-action.ts)

Add registration fields for email/password signup:

```typescript
const user = await payload.create({
  collection: 'users',
  data: {
    name,
    email,
    password,
    role: AccountRole.Student,
    // CORRECT: Email/password signup is a valid registration method
    registrationMethod: 'email',
    registeredAt: new Date().toISOString(),
    localAuthEnabled: true,
  },
})
```

### 1.10b Update Login Action (returnTo)

**Update**: [src/app/(frontend)/login/login_authenticate-action.ts](src/app/(frontend)/login/login_authenticate-action.ts)

Ensure the login action preserves and consumes `returnTo` after successful password login:
- Read `returnTo` from form input or querystring
- After successful login, redirect to `returnTo` if present, otherwise default

**Update**: `src/app/(frontend)/login` UI
- If `error=account_exists`, show: "Account exists for this email. Log in to link Google."
- If `error=oauth_already_linked`, show: "Google account already linked to another user."
- After login success, provide "Link Google" button that hits `/api/auth/google?mode=link&returnTo=...`

### 1.10c Migration Notes for Existing Users

**`localAuthEnabled` Migration Rules:**

1. **Existing users** (created before this feature): default `localAuthEnabled=true`
   - They can log in with email/password as before
   - If they link Google later, `localAuthEnabled` remains `true`

2. **Google-first signup**: `localAuthEnabled=false`
   - Cannot log in with email/password (no known password)
   - Password rotation is allowed for OAuth login

3. **Email/password signup**: `localAuthEnabled=true`
   - Standard password login
   - If they link Google later, `localAuthEnabled` stays `true`

**One-time migration script (optional):**

If you have existing users without `localAuthEnabled` set:

```typescript
// scripts/migrate-local-auth-enabled.ts
import { getPayload } from 'payload'
import config from '@payload-config'

async function migrate() {
  const payload = await getPayload({ config })

  // Set localAuthEnabled=true for all existing users without it
  const result = await payload.update({
    collection: 'users',
    where: { localAuthEnabled: { exists: false } },
    data: { localAuthEnabled: true },
  })

  console.log(`Migrated ${result.docs.length} users`)
}

migrate()
```

**Login Page UX Contract:**

When redirected to `/login` with error params:

| Error Code | Message | CTA |
|------------|---------|-----|
| `account_exists` | "Account exists for this email. Log in to link Google." | Show login form + "Link Google" button after login |
| `oauth_already_linked` | "Google account already linked to another user." | Show login form only |

### 1.11 Error Handling

**Create**: `src/lib/auth/errors.ts`

```typescript
// Error codes are lowercase and URL-safe (used in query params)
export const AUTH_ERROR_CODES = {
  account_exists: 'account_exists',
  oauth_already_linked: 'oauth_already_linked',
  email_in_use: 'email_in_use',
  oauth_failed: 'oauth_failed',
  email_not_verified: 'email_not_verified',
  invalid_state: 'invalid_state',
  invalid_request: 'invalid_request',
} as const

export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  account_exists: 'An account already exists for this email. Please log in to link Google.',
  oauth_already_linked: 'This Google account is already linked to another user.',
  email_in_use: 'An account with this email already exists.',
  oauth_failed: 'Authentication failed. Please try again.',
  email_not_verified: 'Please verify your email with Google first.',
  invalid_state: 'Invalid request. Please try again.',
  invalid_request: 'Invalid request. Please try again.',
}

export function getAuthErrorMessage(code: string): string {
  return AUTH_ERROR_MESSAGES[code as AuthErrorCode] || 'An unexpected error occurred.'
}
```

### 1.12 Translations

**Update**: `messages/en.json`

```json
{
  "auth": {
    "signup": {
      "continueWithGoogle": "Continue with Google",
      "orContinueWith": "or continue with email",
      "oneMethodOnly": "You only need one method to register"
    },
    "errors": {
      "account_exists": "An account already exists for this email. Log in to continue.",
      "oauth_already_linked": "This Google account is already linked to another user.",
      "oauth_failed": "Authentication failed. Please try again.",
      "email_not_verified": "Please verify your email with Google first.",
      "invalid_state": "Invalid request. Please try again.",
      "email_in_use": "An account with this email already exists."
    }
  }
}
```

**Update**: `messages/he.json`

```json
{
  "auth": {
    "signup": {
      "continueWithGoogle": "המשך עם Google",
      "orContinueWith": "או המשך עם אימייל",
      "oneMethodOnly": "צריך רק שיטה אחת להרשמה"
    },
    "errors": {
      "account_exists": "קיים חשבון עם אימייל זה. יש להתחבר כדי להמשיך.",
      "oauth_already_linked": "חשבון Google זה כבר מקושר למשתמש אחר.",
      "oauth_failed": "האימות נכשל. אנא נסה שוב.",
      "email_not_verified": "אנא אמת את האימייל שלך עם Google קודם.",
      "invalid_state": "בקשה לא תקינה. אנא נסה שוב.",
      "email_in_use": "חשבון עם אימייל זה כבר קיים."
    }
  }
}
```

---

## Implementation Order

### Phase 1: Schema & Foundation (Day 1)
1. Update User collection schema with new fields
2. Run `pnpm generate:types`
3. Create error handling utilities
4. Add translations

### Phase 2: Google OAuth (Day 1-2)
1. Install `arctic` dependency
2. Create OAuth library (`google-oauth.ts`, `oauth-state.ts`)
3. Create API routes (`/api/auth/google`, `/api/auth/google/callback`)
4. Create `GoogleSignupButton` component
5. Update signup form with OAuth button
6. Test full OAuth flow

### Phase 3: Email/Password Registration Fields (Day 2)
1. Update existing signup action with registration fields
2. Update login action to consume `returnTo`
3. Verify existing users get `registrationMethod: 'email'`

### Phase 4: Registration Gate (Day 2)
1. Create `registration-gate.ts` utility with `requireRegistration()` function
2. Update protected route layouts to call `requireRegistration()`
3. Test protected routes redirect correctly
4. Keep middleware.ts for locale handling only (no auth checks)

### Phase 5: Testing & Polish (Day 2-3)
1. Test email/password signup with registration fields
2. Test Google OAuth signup end-to-end
3. Test registration gate on all protected routes
4. Verify analytics tracking works for all methods
5. Test error handling for OAuth failures

---

## Files to Create/Modify

### New Files (Stage 1)
- `src/lib/auth/google-oauth.ts`
- `src/lib/auth/oauth-state.ts`
- `src/lib/auth/oauth-cookies.ts`
- `src/lib/auth/errors.ts`
- `src/lib/auth/registration-gate.ts` (server-side gate utility)
- `src/app/api/auth/google/route.ts`
- `src/app/api/auth/google/callback/route.ts`
- `src/app/(frontend)/signup/GoogleSignupButton.tsx`

### Modified Files
- `src/collections/Users/index.ts` - Add `googleSub`, `googleEmail`, `oauthPasswordVersion`, and other new fields
- `src/app/(frontend)/signup/SignupForm.tsx` - Add OAuth buttons
- `src/app/(frontend)/login/login_authenticate-action.ts` - Consume `returnTo` after login
- `src/app/(frontend)/login` - Show account_exists message and Link Google button
- `src/app/(frontend)/signup/actions/signup_createUser-action.ts` - Add registration fields
- `src/app/(frontend)/dashboard/layout.tsx` - Add registration gate call
- `src/app/(frontend)/courses/layout.tsx` - Add registration gate call
- `src/app/(frontend)/learn/layout.tsx` - Add registration gate call
- `src/app/(frontend)/profile/layout.tsx` - Add registration gate call
- `messages/en.json` - Add translations
- `messages/he.json` - Add translations
- `package.json` - Add arctic dependency
- `.env.example` - Document new env vars

**Note**: `middleware.ts` is NOT modified - keep it for locale handling only

---

## Security Considerations

1. **OAuth State** - CSRF protection via state parameter (random 32-byte hex)
2. **PKCE** - Code verifier for OAuth code exchange
3. **Email Verification** - Only accept verified Google emails
4. **Unique Constraints** - Prevent duplicate registrations (sparse indexes)
5. **JWT Security** - HTTP-only, secure cookies (same as existing flow)
6. **ReturnTo Validation** - Only allow relative paths; fallback to `/`
7. **Cookie Deletion** - Delete OAuth cookies via `NextResponse` on the returned response
8. **Server-Side Verification** - Use `getMeUser()` for auth checks (no jwt-decode)
9. **Session Management** - Use Payload's official `payload.login()` API
10. **Identity Linking** - Block linking if Google identity already attached to another user

---

## Acceptance Criteria

### Stage 1 (Google OAuth)
- [ ] User can click "Continue with Google" and complete OAuth flow
- [ ] **New users**: Created with `registrationMethod: 'google'` and random password
- [ ] **New users**: Authenticated via `payload.login()` with random password
- [ ] **New users**: Auto-logged in with JWT token cookie set
- [ ] **New users**: `googleSub`, `googleEmail`, and `oauthPasswordVersion` fields set
- [ ] **Existing users**: Password NOT modified (preserves email/password login)
- [ ] **Existing users**: Redirected to `/login?error=account_exists` (manual login required)
- [ ] **Existing users**: Original fields (name, registeredAt) NOT overwritten
- [ ] **OAuth-only existing users** (`localAuthEnabled=false` + linked identity): password rotated with guard + retry and logged in via `payload.login()`
- [ ] **OAuth-only existing users**: `oauthPasswordVersion` incremented on each password rotation
- [ ] **OAuth-only existing users**: Concurrent callback race condition handled correctly
- [ ] **Link mode**: Authenticated users can link Google and see `success=google_linked`
- [ ] **Link mode**: `googleSub` uniqueness checked against ALL other users before linking
- [ ] OAuth user has `registrationMethod: 'google'` set
- [ ] Session cookie (`${payload.config.cookiePrefix}-token`) is set correctly for new users
- [ ] `googleSub` field is indexed and used for primary OAuth lookup
- [ ] `googleEmail` field is indexed for secondary lookup
- [ ] Duplicate detection works (check `googleSub` then `email` - Payload's login identifier)
- [ ] Registration gate checks `registrationMethod && registeredAt`
- [ ] Registration gate implemented in server layouts using `requireRegistration()`
- [ ] Registration gate uses `getMeUser()` for server-side verification (NOT in Edge middleware)
- [ ] Registration gate redirects unregistered users to signup
- [ ] `returnTo` parameter preserves intended destination
- [ ] `returnTo` is validated to prevent open redirects (relative paths only)
- [ ] Email/password signup still works and sets `registrationMethod: 'email'`
- [ ] Email/password signup sets `localAuthEnabled=true`
- [ ] Google-first signup sets `localAuthEnabled=false`
- [ ] `registrationMethod` field does NOT use `saveToJWT: true`
- [ ] Middleware.ts remains locale-only (no auth checks)
- [ ] Login page consumes `returnTo` after successful password login
- [ ] Login page shows message for `error=account_exists` and offers "Link Google"
- [ ] Login page shows message for `error=oauth_already_linked`
- [ ] All OAuth cookies set via single `setOAuthCookies()` call
- [ ] OAuth cookies are deleted via `cleanupOAuthCookies()` on ALL callback responses
- [ ] Link mode requires authentication (no passwordless session issuance)
- [ ] Link mode blocks already-linked identities (`error=oauth_already_linked`)
- [ ] Error codes are lowercase and URL-safe (`account_exists`, not `ACCOUNT_EXISTS`)
- [ ] Migration script provided for existing users without `localAuthEnabled`

---

## PR Description Template

```markdown
## Summary
Adds Google OAuth registration flow while maintaining existing email/password signup.

## Auth Stack Decision

**Stack**: Payload CMS built-in authentication

**Login Identifier**: `email` (confirmed from `src/collections/Users/index.ts` and existing login UI/actions)

**Session Creation**:
- **New OAuth users**: Created with random passwords, authenticated via `payload.login()` (official API)
- **Existing users**: OAuth-only accounts rotate password + `payload.login()`; otherwise redirect to `/login?error=account_exists`
- JWT token stored in `${payload.config.cookiePrefix}-token` cookie (HTTP-only, secure)

**Authoritative Token**: `${payload.config.cookiePrefix}-token` cookie
- Same as existing email/password flow
- Verified server-side via `getMeUser()` utility

## Changes

### User Schema
- Added `registrationMethod` field ('email' | 'google')
- Added `localAuthEnabled` boolean (guards password rotation for OAuth-only accounts)
- Added `registeredAt` timestamp
- Added `googleSub` (text, unique, indexed) for reliable OAuth lookups
- Added `googleEmail` (email, indexed) for secondary lookups
- Added `oauthPasswordVersion` (number) to guard concurrent callback race
- Added `oauthIdentities` array for OAuth providers (profile data and future providers)

### OAuth Flow
1. User clicks "Continue with Google"
2. Redirects to Google with PKCE
3. Callback validates state and exchanges code for tokens
4. **New users**: Creates user with random password, authenticates via `payload.login()`, auto-login
5. **Existing users**: OAuth-only accounts rotate password + `payload.login()`; others redirect to `/login?error=account_exists`
6. Sets `${payload.config.cookiePrefix}-token` cookie (new users only)
7. Redirects to original destination or `/login` page
8. Link mode (`mode=link`): authenticated users can attach Google identity post-login

### Registration Gate
- Created `requireRegistration()` utility for server-side verification
- Checks `registrationMethod && registeredAt`
- Implemented in protected route layouts (Server Components)
- Uses `getMeUser()` for JWT verification (NOT in Edge middleware)
- Redirects unregistered users to /signup with returnTo parameter
- `registrationMethod` field does NOT use `saveToJWT: true`
- Middleware.ts remains locale-only

### Email/Password Signup
- Now sets `registrationMethod: 'email'`
- Records `registeredAt` timestamp

## Testing
- [x] Google OAuth signup creates registered user (new users)
- [x] New OAuth users auto-logged in
- [x] Existing users: Redirected to `/login?error=account_exists`
- [x] OAuth-only users with linked Google identity can log in via password rotation + guard/retry + `payload.login()`
- [x] Concurrent OAuth callbacks handled correctly (oauthPasswordVersion guards race)
- [x] **CRITICAL**: Existing user passwords NOT changed (can still login with original password)
- [x] **CRITICAL**: Existing users redirected to `/login?error=account_exists`
- [x] New OAuth users authenticated via `payload.login()`
- [x] Email/password signup still works
- [x] Email/password signup sets `localAuthEnabled=true`
- [x] Google-first signup sets `localAuthEnabled=false`
- [x] Registration gate checks `registrationMethod && registeredAt`
- [x] Registration gate protects routes (server-side layouts)
- [x] returnTo parameter works
- [x] returnTo validation blocks open redirects
- [x] Duplicate detection works (checks `googleSub` then `email`)
- [x] `googleSub` field indexed and used for primary lookup
- [x] Middleware.ts remains locale-only
- [x] Login page consumes returnTo after successful password login
- [x] Login page shows message for `error=account_exists` and offers "Link Google"
- [x] Login page shows message for `error=oauth_already_linked`
- [x] All OAuth cookies set via single `setOAuthCookies()` call
- [x] OAuth cookies deleted via `cleanupOAuthCookies()` on ALL callback responses
- [x] Link mode requires authentication and links Google identity
- [x] Link mode checks `googleSub` uniqueness before linking
- [x] Link mode blocks already-linked identities (`error=oauth_already_linked`)
- [x] Error codes are lowercase and URL-safe
```
























