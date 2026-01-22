# HLS — Google OAuth Registration (WilsonLe/payload-oauth2)

## Goal

Ship a **Google OAuth-only** registration + sign-in flow using **WilsonLe/payload-oauth2** that:

- Creates a new user when no user exists for the Google identity.
- Signs in an existing user only when the Google identity is already linked.
- Never auto-links accounts by email (explicit linking only).
- Establishes a server-side “registration gate” so unregistered users cannot proceed.

## Non-Goals

- Multi-provider OAuth (Google only).
- Password-based registration/login (Stage 1 is Google-only).
- Automatic account linking by email match.
- Complex account recovery flows.

## Architecture Overview

**Actors**

- Browser (Next.js App Router frontend)
- Payload API (auth collection: `users`)
- WilsonLe/payload-oauth2 plugin endpoints

**Main Endpoints**

- `GET /oauth/google` (authorize start)
- `GET|POST /oauth/google/callback` (callback)

**Session Mechanism**

- Must rely on Payload’s standard auth cookie: `${payload.config.cookiePrefix}-token`
- Cookie is set server-side in the callback response.

## Primary Flows

### Flow A — New User via Google OAuth (Create + Register)

1. User clicks “Continue with Google”.
2. Redirect to `/oauth/google` → provider auth.
3. Callback hits `/oauth/google/callback`.
4. Plugin fetches userinfo, extracts required claims.
5. If no user exists by **Google `sub`**:
   - Create a new user with:
     - `googleSub = sub`
     - `verifiedEmail = email` (only if trusted rules pass)
     - `fullName` (from provider or fallback)
     - `registrationMethod = "google"`
     - `registeredAt = now`
6. Plugin sets Payload auth cookie.
7. Redirect to a safe `returnTo` (default `/`).

### Flow B — Existing User Already Linked (Sign-in)

1. User initiates Google OAuth.
2. Callback resolves user by `googleSub`.
3. Sign in by setting auth cookie.
4. Redirect to safe `returnTo`.

### Flow C — Email Collision (Explicit Link Required)

If callback returns `email` that matches an existing user **but** there is no matching `googleSub`:

- Do **NOT** link automatically.
- Treat as a collision event and redirect to:
  - `/login?error=account_exists&link=google`
- User must sign in through an explicit linking flow (future or separate endpoint guarded by session).

## Data Model

### Users Collection Additions (Auth Collection)

Required fields:

- `googleSub` (text)
  - Must be **unique + sparse** at DB level to prevent duplicates and allow multiple nulls.
- `verifiedEmail` (text)
- `registrationMethod` (select: `"google" | "password" | ..."` — Stage 1 uses `"google"` only)
- `registeredAt` (date)
- `fullName` (text)
  Optional:
- `googleProfile` (group): `name`, `picture`

## Provider Claims Requirements

Minimum required:

- `sub` (required)
- `email` (required)
- `email_verified` (required if available)

Rules:

- If `email_verified` is present and `false` → fail registration (redirect failure).
- If `email_verified` is missing:
  - Only treat as verified if your chosen Google userinfo contract guarantees verified emails.
  - Otherwise: do not set `verifiedEmail` and do not set `registeredAt` (forces completion flow).

## Security & Guardrails (Critical)

### G1 — No Auto-Link by Email (BLOCKER)

- Plugin must run with `useEmailAsIdentity: false`.
- Collision by email must not mutate existing user.
- Any “create-or-link by email” language is rejected for Stage 1.

### G2 — Unique Identity Constraint (BLOCKER)

- `googleSub` must be unique+sparse at DB level.
- Concurrency: two callbacks must not create two users for the same `sub`.

### G3 — Open Redirect Prevention (BLOCKER)

- `returnTo/state` must be sanitized:
  - Only allow relative paths starting with `/`
  - Block `://`, `//`, encoded protocol-relative
- `successRedirect` must apply sanitization before redirect.

### G4 — No Sensitive Token Logging (High)

- Never log OAuth codes, access tokens, refresh tokens, or JWTs.
- Log failures with correlation id.

## Registration Gate (Server-Side)

All protected app routes must enforce:

- User must be authenticated (Payload session)
- User must be registered:
  - `registeredAt` exists AND `registrationMethod === "google"` AND `verifiedEmail` exists
    If not registered:
- Redirect to `/register` (Google OAuth entry point)

## Operational Requirements

- Environment:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `SERVER_URL` / canonical base URL used by plugin
- Observability:
  - Structured logs with correlation id on auth start and callback.

## Acceptance Criteria

1. Successful Google OAuth sets the Payload auth cookie server-side.
2. New user is created only when no user exists with matching `googleSub`.
3. Existing user signs in only when `googleSub` matches.
4. Email collision never links automatically and never mutates an existing user.
5. `returnTo` cannot redirect to an external domain.
6. Registered user record contains:
   - `verifiedEmail`
   - `registrationMethod="google"`
   - `fullName` (or explicit post-login completion)
   - `registeredAt`
7. Registration gate blocks unregistered users from protected routes.

## Key Decisions

- Use `sub` as the sole OAuth identity key (not email).
- Explicit linking only (email collisions require user action).
- Add DB-level unique+sparse index on `googleSub`.
- Sanitize redirects in `successRedirect`.
