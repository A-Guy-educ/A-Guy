# Task

## Issue Title

[pipeline-fix] Cody fails at build: Pipeline failed at stage: build (failed): Agent "build" failed. Artifacts: build
## Context

Task `260316-auto-648` (issue #822) has failed at the `build` stage **3 times** with the same error.

## Error

```
Pipeline failed at stage: build (failed): Agent "build" failed. Artifacts: build-stderr.log, build-events.jsonl
```

## Stage Output (`build.md`)

_No stage output available (status.json may be on feature branch)_

## Verify Output

_No verify output available_

## What Was Tried

- Retry 1: rerun from `build` — same failure
- Retry 2: rerun from `build` — same failure

## Original Issue (#822)

# QA Implementation Plan — Critical + High Priority

**Date**: 2026-03-14  
**Branch**: dev (commit directly — no feature branch)  
**Context**: Following the pipeline simplification (complete) and full QA audit (complete).

---

## Background

The QA audit identified 15 areas of concern. This plan covers all **Critical** and **High Priority** items only.

### Audit Summary

| Area | Grade | Status |
|---|---|---|
| Security Headers | D | ❌ No CSP, X-Frame-Options, HSTS, etc. in next.config.js |
| Frontend Error Boundary | C | ❌ Missing error.tsx in (frontend) route group |
| Env Variable Validation | F | ❌ No startup-time validation at all |
| Pre-launch E2E Tests | — | ❌ On diverged branch (feat/pre-launch-e2e-verification) |
| Sentry Capture in API Routes | C | ❌ 30 routes with catch blocks but no Sentry reporting |
| Zod Validation in API Routes | C+ | ❌ 21 POST routes without Zod input validation |
| CI Coverage Enforcement | — | ❌ No --coverage flag, no thresholds |
| Web Vitals Tracking | C- | ❌ Sentry installed but browserTracingIntegration not configured |

---

## Phase 1: Critical Items (commit together)

### 1. Security Headers — `next.config.js`

Add `async headers()` function with **split CSP** strategy:
- **All routes (`/*`)**: Strict CSP (self, Vercel Blob, YouTube, Sentry tunnel, unsafe-inline for styles)
- **Admin routes (`/admin/*`)**: Permissive CSP (unsafe-eval, unsafe-inline — required by Payload admin panel)

Headers to add for all routes:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-DNS-Prefetch-Control: on`

**File**: `next.config.js`

---

### 2. Frontend Error Boundary — `src/app/(frontend)/error.tsx`

CREATE new file. Mirror the existing `global-error.tsx` pattern:
- `'use client'` directive
- `useEffect` → 

## Your Job

Analyze why Cody's pipeline keeps failing on this task and fix the pipeline code so it can handle this case. This could be:
- A prompt improvement in `scripts/cody/`
- A config change (timeouts, chunking, scoping)
- A bug fix in the pipeline code
- A new mechanism the pipeline needs

**Scope**: Only modify files in `scripts/cody/`. Do NOT fix the task's generated code.
**Target branch**: `dev`
