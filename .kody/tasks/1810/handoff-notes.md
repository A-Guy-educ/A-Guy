Fixed CI failure in `tests/int/admin-transactions-rest-api.int.spec.ts`.

**Root cause:** Test "returns 401 without auth" expected HTTP 401, but Payload CMS REST API returns HTTP 403 for all access-denied cases — both unauthenticated requests and authenticated-but-unauthorized requests receive 403. Payload does not distinguish between 401 (authentication required) and 403 (authorization denied).

**Fix:** Changed `expect(res.status).toBe(401)` to `expect(res.status).toBe(403)` at line 148, with a comment explaining Payload's behavior. Also updated the test description comment from "returns 401" to note the actual 403 response.

**Note:** The test named "returns 403 for non-admin users" was already correct. After this fix both unauthenticated and non-admin authenticated requests return 403 — Payload treats them identically.
