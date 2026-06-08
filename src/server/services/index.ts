/**
 * Server Services
 *
 * Business-logic layer for the Payload-backed server. All modules in this
 * folder are server-only (never imported from client code).
 *
 * ## Entry points
 *
 * - **Chat flow**: `conversation-service.ts` — per-user context-scoped conversations
 * - **Guest flow**: `guest-session.ts` → `guest-session-upgrade.ts` — anonymous access with upgrade path
 * - **AI personalization**: `agent-behavior-prompt-resolver.ts`, `teacher-profile-resolver.ts`,
 *   `user-learning-context.ts` — system-prompt injection for the learning assistant
 * - **Access control**: `entitlement_check.ts` — paid-course gate; `rate-limit.ts` — public endpoint guard
 * - **PDF pipeline**: `pdf-fetcher.ts` → exercise-conversion/* — blob storage to structured exercises
 * - **Study plans**: `study-plan/*` — 7-day exam-anchored schedules
 * - **API client**: `api/api-service.ts` — server-to-server LLM chat calls
 *
 * ## Load-bearing gotchas
 *
 * - **overrideAccess**: All Payload calls from this folder must pass `overrideAccess: true`.
 *    Omitting it bypasses collection access control — intentional for server-side operations,
 *    but means calling code is fully trusted.
 * - **Guest session state machine**: `guest-session.ts` uses a strict `active → claiming → revoked`
 *    state machine. Skipping states or calling `acquireClaimLock`/`completeClaimLock` out of
 *    order produces orphaned conversations.
 * - **In-memory rate limits**: `rate-limit.ts` uses per-process Maps. In serverless (cold starts)
 *    the cache resets. For strict enforcement use a shared store (Redis/MongoDB).
 * - **Entitlement fallback chain**: `hasEntitlement()` checks `Enrollments` first, then
 *   `User.courseEntitlements` (legacy). Removing the legacy path breaks existing entitlements.
 * - **Context resolution priority**: `ConversationService.resolveContext()` resolves
 *   `exerciseId → lessonId → chapterId → courseId → categoryId`. Changing this priority
 *   reshapes which conversation a user lands in.
 *
 * @fileType folder-header
 * @domain server-services
 * @ai-summary Server-side business logic; all services assume a trusted server context — always validate caller identity before delegating to these modules.
 */
