# Fix: getMeUser malformed Cookie header

**Root cause**: `getMeUser` at `src/infra/utils/getMeUser.ts:38` used `cookieStore.toString()` to construct the Cookie header. Since `RequestCookies` extends `Map`, `Map.prototype.toString()` returns `"[object RequestCookies]"` — not the serialized cookie string. This caused the Cookie header sent to `/api/users/me` to be malformed.

**Fix**: Changed to `Array.from(cookieStore).map(([k, v]) => `${k}=${v}`).join('; ')` which properly serializes the cookies.

**Why this caused admin to work but not frontend**: Admin uses Payload's built-in auth which validates via the `payload-token` cookie read from the request directly. Frontend uses `getMeUser` which calls `/api/users/me` — this endpoint received the malformed Cookie header while the Authorization header with the JWT was still sent. If Payload's validation depends on the Cookie header (not just Authorization), the request would fail, causing `getMeUser` to return `user: null` and redirect to login.

**Files changed**:
- `src/infra/utils/getMeUser.ts` — fixed cookie header serialization

**Not fully investigated**: The symptom of "page remained at /login" with no error shown after clicking login suggests there may be an additional issue with how the login form handles the redirect (`window.location.href = returnTo`) or how `returnTo` is passed through the flow.
