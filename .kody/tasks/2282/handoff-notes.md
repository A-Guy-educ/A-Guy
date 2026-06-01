# Fix for #2282: BuyButton shows 'Log in to Buy' to authenticated user

## Root Cause
`useCurrentUser` calls `/api/users/me` with only `credentials: 'include'` (cookies), but Payload's `/api/users/me` endpoint requires the `Authorization: JWT <token>` header to verify the session. The server-side `getMeUser` (used in server components) correctly reads the token and sends it as an Authorization header; the client-side hook did not.

## Fix
Modified `src/client/hooks/useCurrentUser.ts` to read the `payload-token` cookie client-side and send it as `Authorization: JWT <token>` header when fetching `/api/users/me`. This matches how the server-side `getMeUser` calls the same endpoint.

## Files Changed
- `src/client/hooks/useCurrentUser.ts` — Added `getAuthToken()` helper and Authorization header in fetch call
- `tests/unit/hooks/useCurrentUser.test.ts` — New regression test verifying Authorization header is sent

## Test
Reproduction test: `tests/unit/hooks/useCurrentUser.test.ts` — verifies that when `payload-token` cookie is present, the fetch to `/api/users/me` includes `Authorization: JWT <token>`.
