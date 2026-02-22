# Spec: 260220-auto-34

## Overview

Remove or replace remaining `console.log` statements (approximately 65 instances) across the codebase. These raw logging statements pollute server logs and risk leaking internal data in production. Server-side logs must be refactored to use the structured Pino logger, and client-side or analytics logs must either be removed completely or gated behind a `NODE_ENV === 'development'` conditional check.

## Requirements

### FR-001: Server-Side Logging Migration

**Priority**: MUST
**Description**: All instances of `console.log`, `console.warn`, and `console.error` in server-side files (e.g., V1/V2 exercise conversion services, job tasks, API routes) MUST be replaced with the Payload Pino logger. Depending on context, this should use `req.payload.logger` or an imported Pino logger instance.

### FR-002: Analytics Logging Migration

**Priority**: MUST
**Description**: Analytics infra files (`tracker.ts`, `system-events-subscriber.ts`, `mixpanel/adapter.ts`, `ga4/adapter.ts`, `config.ts`, hooks, utils, and scripts) MUST either utilize the structured Pino logger (if running server-side) or gate `console.log` statements behind a `process.env.NODE_ENV === 'development'` check to prevent log pollution in production environments.

### FR-003: Client-Side Logging Removal

**Priority**: MUST
**Description**: UI components and client-side scripts (specifically `CommandPalette.tsx`, `scripts.tsx` in ga4 adapter) MUST have their `console.log` statements completely removed, or conditionally executed only if `process.env.NODE_ENV === 'development'`. All `console.error` statements in client-side code MUST be removed entirely.

### FR-004: Related Exercise-Conversion Service Files

**Priority**: MUST
**Description**: Additional files in the exercise-conversion service that contain console statements must also be migrated:
- `vision-detection-service.ts` - contains console.warn and console.error
- `helpers.ts` - contains console.error

These are part of the same V1/V2 conversion pipeline and must be included.

### NFR-001: Error Visibility

**Priority**: MUST
**Description**: Error logs (`console.error`) should be retained but explicitly upgraded to `logger.error()` on the server side. Critical debugging information and error stacks must not be lost during this migration. **Client-side console.error statements must be removed entirely** - browser console is not a structured logging destination.

## Acceptance Criteria

- [ ] No raw `console.log` statements exist in `text-detection-service.ts`, `vision-text-combo-service.ts`, and `ocr-detection-service.ts`.
- [ ] No raw `console.log` statements exist in `pdf-to-exercises-v2-task.ts` and `pdf-to-exercises-task.ts`.
- [ ] No raw `console.log` statements exist in `vision-detection-service.ts` and `helpers.ts` (related exercise-conversion files).
- [ ] No raw `console.log` statements exist in analytics infrastructure files (`tracker.ts`, `system-events-subscriber.ts`, `mixpanel/adapter.ts`, `ga4/adapter.ts`, `config.ts`, hooks, utils, scripts).
- [ ] No raw `console.log` statements exist in API routes (`run-immediate/route.ts`, `exercises/import/route.ts`, `prompts/for-conversion/route.ts`, `exercises/convert/runner/route.ts`, `exercises/convert/queue/route.ts`, `exercises/convert/queue-v2/route.ts`).
- [ ] Client-side UI files (`CommandPalette.tsx`, `scripts.tsx` in ga4 adapter) contain no unconditional `console.log` statements.
- [ ] Client-side `console.error` statements are completely removed.
- [ ] Existing server-side error logging properly utilizes the Payload Pino logger (`@/infra/utils/logger`).

## Guardrails

- MUST NOT change the underlying behavior, data extraction, or business logic within the modified files.
- MUST NOT cause application crashes if `req.payload.logger` is unavailable; use the standalone logger import instead: `import { logger } from '@/infra/utils/logger'`
- MUST NOT introduce breaking changes to component or service exported interfaces.
- MUST NOT log sensitive Personally Identifiable Information (PII) or internal credentials in the refactored structured logs.
- Server-side logs MUST use Pino logger unconditionally; NODE_ENV check is only for client-side development logs.

## Out of Scope

- Adding new logging logic for unlogged events, branches, or features.
- Modifying the core logging configuration or Pino setup itself.
- Any refactoring of code structures outside of logger replacements.