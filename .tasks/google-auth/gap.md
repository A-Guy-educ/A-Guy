# GAP — Google OAuth Registration (WilsonLe/payload-oauth2)

## Scope

Validate and close gaps between the **desired HLS** and the **actual behavior/limits** of WilsonLe/payload-oauth2 + your Payload/Next.js stack.

---

## GAP-01 — Email-based auto-linking risk

### Risk

If `useEmailAsIdentity: true`, the plugin may update/link an existing user purely by matching email (account takeover vector).

### Required Decision

**Must** enforce: `useEmailAsIdentity: false`.

### Validation Checks

- Confirm config sets `useEmailAsIdentity: false`.
- Confirm callback path never queries/updates user by email as an identity key.

### Done When

- Plugin is configured so identity resolution is **sub-only**.
- Email collision routes to your explicit-link flow (or blocking error) with no mutation.

---

## GAP-02 — Email collision handling (explicit link requirement)

### Risk

HLS requires: if email matches an existing user but no googleSub match → **do not link**.

### Unknown

The plugin does not expose a dedicated “collision hook”; behavior must be enforced via config + userinfo logic + redirect handling.

### Validation Checks

- Simulate: existing user with `email=X`, `googleSub=null`
- Login with Google for `email=X`, `sub=Y`
- Verify: user record is NOT updated with `googleSub=Y`
- Verify: redirect goes to `/login?error=account_exists&link=google` (or equivalent)

### Done When

- Collision is deterministic and safe.
- No silent linking occurs.

---

## GAP-03 — DB uniqueness for googleSub (race safety)

### Risk

Plugin adds `sub` field with `index: true` but not `unique: true` by default → duplicates possible under concurrency.

### Required Change

Add `googleSub` field with:

- `unique: true`
- `sparse: true`
- `index: true`

### Validation Checks

- Confirm Mongo index exists and is unique+sparse.
- Concurrency test: 5 parallel callbacks for same `sub` → only one user exists.

### Done When

- DB enforces uniqueness and concurrent callbacks cannot create duplicates.

---

## GAP-04 — Redirect / state / returnTo open-redirect protection

### Risk

Plugin forwards user-provided `state` without validation; redirect target depends on your `successRedirect`.

### Required Change

Implement `sanitizeReturnTo()` and apply it inside `successRedirect`.

### Validation Checks

- `returnTo=http://evil.com` → redirects to safe default
- `returnTo=//evil.com` → safe default
- `returnTo=/dashboard` → allowed

### Done When

- No external redirect possible through returnTo/state.

---

## GAP-05 — Email verification contract

### Risk

You require `email_verified=true` (or a guaranteed equivalent). Google userinfo may or may not provide it depending on endpoint/scope.

### Required Decision

Pick one:

- **Strict**: require `email_verified === true` or fail registration.
- **Assumption**: treat Google email as verified only if your chosen API contract guarantees it.

### Validation Checks

- Confirm which endpoint you use (`userinfo`) and whether it returns `email_verified`.
- Test behavior when missing/false.

### Done When

- Registration sets `verifiedEmail` only when policy is satisfied.
- Otherwise user is not marked registered.

---

## GAP-06 — Registration gate correctness (server-side)

### Risk

Users may authenticate but bypass “registeredAt/verifiedEmail” requirements.

### Required Change

Centralize server-side gating for protected routes:

- Must be authenticated
- Must have `registeredAt` + `verifiedEmail` + `registrationMethod="google"`

### Validation Checks

- Authenticated but unregistered user cannot access protected routes.
- After OAuth completion, access is granted.

### Done When

- Gate is enforced consistently (no route misses).

---

## GAP-07 — Cookie attributes & cross-site behavior

### Risk

OAuth redirects and admin/app domains can cause cookie issues (SameSite/secure/domain/path).

### Validation Checks

- Confirm cookie name is `${cookiePrefix}-token`
- Confirm attributes align with deployment:
  - `httpOnly=true`
  - `secure=true` on HTTPS
  - `sameSite` matches your flow (typically `lax` or `none` depending on cross-site)
  - `path=/`

### Done When

- `/api/users/me` works immediately after callback in production-like environment.

---

## GAP-08 — Observability without leaking secrets

### Risk

OAuth tokens/codes accidentally logged.

### Validation Checks

- Search logs for `code=`, `access_token`, `refresh_token`, JWT patterns.
- Ensure correlation id logged on start + callback failure.

### Done When

- Logs contain only safe metadata.

---

## Output Artifacts Required

1. Updated Users collection schema (`googleSub` unique+sparse, registration fields).
2. Plugin config wired to Google with `useEmailAsIdentity: false`.
3. `sanitizeReturnTo()` util + applied in `successRedirect`.
4. Collision handling path (redirect + no mutation).
5. Registration gate middleware/guard.
6. Tests: collision, concurrency, redirect security, cookie/me, registration gate.
