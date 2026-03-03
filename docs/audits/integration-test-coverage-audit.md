# Integration Test Audit — Missing Coverage

> Audit date: 2026-03-03
> Scope: All system boundaries (API ↔ DB, API ↔ LLM, Auth ↔ Permissions, Hooks ↔ DB, Cron ↔ DB, Frontend ↔ Backend)
> Existing tests: 58 integration specs, 7 E2E specs (3 active, 4 fully skipped)

---

## P0 — Critical (production risk / data loss / security / core flow break)

| # | Title | Covered Flow | Why It Matters | Risk If Not Tested | Dependencies |
|---|-------|-------------|----------------|-------------------|-------------|
| 1 | Guest session upgrade — conversation ownership transfer | `claimGuestConversations()` → find guest conversations → transfer ownership → revoke session → clear cookie | Runs sequential Payload `update()` calls **without a transaction**. Partial failure orphans conversations — user loses chat history permanently. | **Data loss**: conversations stuck in limbo (no user, no guest session). User sees empty chat after login. | DB (conversations, guest-sessions, users), Auth (cookie clearing) |
| 2 | OAuth collision — link Google to existing email account | `handleCollision()` in `/api/oauth/google/callback` → direct MongoDB `updateOne` (bypasses Payload hooks) → issue session | Uses raw `updateOne` bypassing all hooks and access control. If collision detection fails, duplicate accounts or unauthorized linking. | **Security breach**: attacker could link their Google account to victim's email. **Data corruption**: duplicate user records. | DB (users), Google OAuth API, Auth (session issuance) |
| 3 | Last admin demotion race condition | `preventLastAdminDemotion` hook → `payload.count({role: admin})` → allow/deny demotion | Hook counts admins then processes demotion. Two concurrent requests could both see count=2 and both proceed, leaving zero admins. | **Admin lockout**: no admin can access system. Requires direct DB intervention to recover. | DB (users), Auth (admin role) |
| 4 | Exercise answer validation — full two-tier flow | `POST /api/exercises/validate-answer` → DB normalization check → LLM semantic fallback (for algebraic/text equivalence) | Core learning feature. DB check + LLM fallback tested separately but never together against a real DB exercise with various answer types. | **Broken grading**: students get incorrect pass/fail on exercises. Silent degradation — no error, just wrong results. | DB (exercises), LLM provider (OpenAI/Gemini), Auth |
| 5 | Cron: guest session cleanup execution | `POST /api/cron/guest-sessions-cleanup` → auth via CRON_SECRET → find expired/revoked sessions → delete | No integration test exists. Only media-cleanup cron is tested. Guest sessions accumulate without cleanup. | **DB bloat / data leak**: expired guest sessions (with conversation refs) never purged. PII retention violation. | DB (guest-sessions), Cron auth (CRON_SECRET) |
| 6 | Cron: chat asset expiry cleanup | `POST /api/cron/chat-asset-expiry` → auth → find expired assets → delete from Blob + DB | Ephemeral chat assets (user-uploaded images) must be purged. No integration test for the full flow. | **Storage cost escalation**: orphaned blobs accumulate. **Privacy risk**: user files retained past policy. | DB (chat-assets), Vercel Blob API, Cron auth |
| 7 | Cron: upload session cleanup | `POST /api/cron/upload-session-cleanup` → auth → find orphaned sessions → cleanup | Upload sessions stuck in `initiated` or `uploaded` status are never cleaned. No test. | **Data inconsistency**: phantom upload sessions block future uploads with same sessionId. | DB (upload-sessions), Cron auth |
| 8 | V3 extraction log gate — mismatched context rejection | `POST /api/exercises/convert/single/create` → validate extraction log belongs to correct lesson + media → create exercise | Security gate: ensures exercises can only be created from authorized extraction contexts. No integration test for rejection path. | **Unauthorized content creation**: admin could create exercises from extraction logs belonging to different lessons. Data integrity violation. | DB (extraction-logs, exercises, lessons, media), Auth (admin) |
| 9 | Conversation archivedAt protection — hook enforcement | `conversations.beforeChange` hook → strip `archivedAt` unless `req.context.allowArchive === true` | Prevents accidental archival via normal update operations. Only reset-chat (with context flag) should archive. | **Data loss**: any update could accidentally archive a conversation, hiding it from the user permanently. | DB (conversations), Payload hooks |
| 10 | Media upload validation hook — MIME & size enforcement | `validateMediaUploadHook` → check MIME type whitelist → check file size limit → reject or allow | First line of defense against malicious file uploads. Hook tested implicitly but no dedicated integration test for rejection scenarios. | **Security**: malicious files (executables disguised as images) could be uploaded and stored. | DB (media), Vercel Blob, Payload hooks |

---

## P1 — Important (major feature degradation)

| # | Title | Covered Flow | Why It Matters | Risk If Not Tested | Dependencies |
|---|-------|-------------|----------------|-------------------|-------------|
| 11 | Teacher profile → prompt resolution chain | `user_settings.teacherProfile` → `teacher_profiles.systemPrompt` → `prompts.template` → injected into chat system prompt | Three-collection join determines AI personality. If any link breaks, chat uses wrong or no persona. | **Feature degradation**: all users get default AI personality regardless of settings. Silent failure. | DB (user_settings, teacher_profiles, prompts), Auth |
| 12 | User settings auto-creation on signup | `users.afterChange: createUserSettings` hook → create `user_settings` record → same transaction as user creation | Hook swallows errors silently. If it fails, user has no settings record — teacher profile selection breaks. | **Broken UX**: new users can't select teacher profile. Settings page errors. No automatic recovery. | DB (users, user_settings), Payload hooks |
| 13 | Conversation context hierarchy traversal | `ConversationService.buildContextHierarchy(contextKey)` → exercise → lesson → chapter → course | Used for memory retrieval scoping. If broken, memories from parent contexts (lesson, course) are not retrieved. | **Degraded AI quality**: chat loses access to lesson/course-level memories. Answers lack context. | DB (exercises, lessons, chapters, courses) |
| 14 | Chat asset upload — full multi-step flow | `POST /api/blob/upload-token` → Vercel Blob direct upload → `POST /api/chat-assets/finalize` → verify blob → create chat-asset → update upload-session | Three-step flow with external service call in the middle. Each step can fail independently. | **Lost uploads**: user uploads file but finalization fails — blob exists but no DB record. Orphaned storage. | DB (chat-assets, upload-sessions), Vercel Blob, Auth |
| 15 | Rate limiting under concurrent load | `checkRateLimit(ipHash, userAgentHash)` → in-memory sliding window → read config from DB | In-memory only, resets on deploy. No test for concurrent requests from same IP hitting the limiter simultaneously. | **Abuse vector**: rate limit bypass during deploys or under concurrent load. Guest chat abuse. | In-memory cache, DB (config_values) |
| 16 | Media embed resolution — YouTube/Vimeo metadata | `resolveEmbedHook` → detect external URL → fetch oEmbed metadata → populate embedProvider, embedVideoId, etc. | External API call in a Payload hook. If oEmbed endpoint changes, all video embeds break silently. | **Broken video embeds**: media records created without metadata. Admin UI shows blank video previews. | External APIs (YouTube oEmbed, Vimeo oEmbed), DB (media) |
| 17 | V1 PDF conversion — end-to-end pipeline | Queue job → claim → segment pages → render → LLM extract → LLM verify → dedup → upsert exercises | Individual pieces tested (queuing, dedup, idempotency) but never the full pipeline with real PDF → exercises in DB. | **Silent pipeline failure**: conversion appears to complete but produces zero or corrupt exercises. Hard to detect without E2E coverage. | DB (exercises, lessons, media), LLM (Gemini multimodal), Vercel Blob, Payload jobs |
| 18 | V3 single exercise extraction preview | `POST /api/exercises/convert/single` → resolve prompt → call LLM with image → parse response → return preview (no DB write) | New V3 pipeline. No integration test at all. Preview is the first step before exercise creation. | **Broken admin workflow**: V3 convert button fails silently. Admins forced to use V1/V2 pipelines. | LLM (Gemini/OpenAI), DB (prompts, lessons, media), Auth (admin) |
| 19 | Study plan generation & user-progress upsert | `PUT /api/study-plan` (action=generate) → call LLM → parse plan → upsert user-progress record | `handleGenerate` has inconsistent `overrideAccess` usage between create and update paths. Owner constraint potentially bypassed on create. | **Cross-user data leak**: study plan could be created under wrong user. **LLM failure**: malformed plan silently stored. | DB (user-progress), LLM, Auth |
| 20 | Conversation `DELETE` endpoint — owner isolation | `DELETE /api/conversations/by-context` → verify owner → archive via `overrideAccess: true` + context flag | Uses `overrideAccess: true` to set `archivedAt` (since field-level access blocks normal write). Must still verify owner. | **Data tampering**: user could archive another user's conversation if owner check is insufficient. | DB (conversations), Auth |

---

## P2 — Nice to have (edge cases / resilience / observability)

| # | Title | Covered Flow | Why It Matters | Risk If Not Tested | Dependencies |
|---|-------|-------------|----------------|-------------------|-------------|
| 21 | Slug uniqueness under concurrent creation | `exercises.beforeValidate: validateSlugUniqueness` → query existing → append suffix | Slug collision window between check and insert. Under load, duplicate slugs could break routing. | **404 errors**: duplicate slugs cause wrong exercise to load or 404s. | DB (exercises) |
| 22 | MCP tool-calling audit trail | Admin chat → MCP client → tool execution → `mcp-audit-logs` record creation | Tool calls against production data should be logged. No integration test for audit log creation. | **Missing audit trail**: admin actions via MCP chat not recorded. Compliance gap. | DB (mcp-audit-logs), MCP client |
| 23 | Guest session sliding TTL + hard expiry interaction | `getGuestSessionByToken` → check `expiresAt` (sliding) AND `hardExpiresAt` (fixed cap) | Two expiry mechanisms interact. Edge case: sliding TTL extends past hard cap. Should be capped. | **Extended sessions**: guests retain access past intended hard limit. Minor privacy concern. | DB (guest-sessions) |
| 24 | Extraction logs append-only constraint | `extraction-logs` collection access: `create: () => false`, `update/delete: () => false` | Immutability enforced via access control. If bypassed, extraction history can be tampered with. | **Audit integrity**: modified logs could mask conversion issues. Low production impact. | DB (extraction-logs) |
| 25 | Config values domain validation edge cases | `config_values.beforeChange` → validate domain → check for secret-like keys in plain config | Partially tested. Edge cases: very long config JSON, nested secret-like keys, Unicode in values. | **Config corruption**: invalid config values silently accepted. Minor — caught at runtime. | DB (config_values) |
| 26 | Chapter adminTitle cascade across tenants | `chapters.afterChange` → cascade course title change → recompute adminTitle | Tested for basic case. Not tested when course has chapters across multiple tenants. | **Admin confusion**: stale adminTitle in admin panel. Display-only issue. | DB (chapters, courses) |
| 27 | Analytics event dispatch pipeline | `trackEvent()` → validate → dispatch to subscriber(s) | Only validator tested. Full dispatch (including subscriber error handling) not covered. | **Silent analytics loss**: events validated but never dispatched. Metrics gaps. | Analytics infrastructure |
| 28 | Upload session expiry edge cases | Upload session created → user abandons → session stuck in `initiated` → cleanup job finds it | Cleanup tested only for media. Upload session cleanup path not verified. | **Stale data**: abandoned upload sessions accumulate. Low storage impact but messy. | DB (upload-sessions) |
| 29 | Middleware locale with real Next.js context | Middleware applies locale from subdomain/cookie/Accept-Language → sets NEXT_LOCALE cookie → Next.js picks up | Tested with mocked NextRequest. Real Next.js middleware execution path not tested. | **Wrong locale**: edge cases where cookie and subdomain conflict in production. | Next.js middleware |
| 30 | Health endpoint under DB failure | `GET /api/health` → return status even when MongoDB is down | Currently always returns `ok: true`. Should gracefully degrade when DB is unreachable. | **False healthy**: monitoring shows green when DB is actually down. | DB connection, Health endpoint |

---

## Summary

| Priority | Count | Key Themes |
|----------|-------|-----------|
| **P0** | 10 | Cron job execution, security gates, race conditions, data integrity hooks, auth flows |
| **P1** | 10 | Multi-step workflows, LLM pipeline E2E, service chain composition, owner isolation |
| **P2** | 10 | Edge cases, audit trails, resilience, observability |

### Coverage Heat Map

| System Boundary | Existing Coverage | Gap Severity |
|----------------|-------------------|-------------|
| Auth ↔ DB (login/OAuth) | Good (3 test files) | **P0**: OAuth collision path |
| Chat ↔ DB ↔ LLM | Strong (6 test files) | **P1**: teacher profile chain |
| Memory ↔ DB ↔ Embeddings | Strong (4 test files) | **P1**: context hierarchy |
| Exercises ↔ DB | Good (contracts + checkAnswer) | **P0**: answer validation E2E |
| PDF Pipeline ↔ LLM ↔ DB | Partial (dedup/idempotency) | **P1**: full V1/V3 pipeline |
| Cron Jobs ↔ DB | Weak (only media-cleanup) | **P0**: 3 cron jobs untested |
| Hooks ↔ DB (data integrity) | Partial (chapter adminTitle) | **P0**: archivedAt, last admin, media validation |
| Config ↔ DB ↔ Crypto | Good (3 test files) | **P2**: edge cases only |
| Guest Sessions ↔ DB | Moderate | **P0**: upgrade flow, **P2**: TTL edge cases |
| Media Upload ↔ Blob ↔ DB | Good (3 test files) | **P1**: chat asset finalization flow |
| Middleware ↔ Routing | Good (1 test file) | **P2**: real Next.js context |
