# Plan Gap Analysis: 260309-auto-822

## Summary

- Gaps Found: 5
- Plan Revised: Yes

## Gaps Identified

### Gap 1: Implementation location violated NFR-009

**Severity:** Critical  
**Issue:** Original plan placed all new converter modules under `src/server/services/exercise-conversion/v3/`, but spec requires implementation under `src/server/payload/endpoints/exercises/` following endpoint module/service patterns.  
**Fix Applied:** Updated all new module paths to `src/server/payload/endpoints/exercises/v3-converter/**` and kept `transform.ts` as compatibility/delegation entrypoint.

### Gap 2: Missing explicit normalization step (FR-002)

**Severity:** High  
**Issue:** Plan jumped to detection/segmentation without a dedicated lossless normalization phase for full V3 payload semantics (options/keys/geometry/media/unknown fragments).  
**Fix Applied:** Added Step 0 (`normalize.ts`) with deterministic, no-drop normalization and dedicated tests (`v3-normalize.test.ts`).

### Gap 3: Media asset mapping conflicted with native schema

**Severity:** High  
**Issue:** Original plan proposed URL-style media references, but native `media` block requires `mediaId` (persisted asset/document ID).  
**Fix Applied:** Revised asset plan so `createMediaAsset` materializes/resolves persisted assets and mapper emits `media` blocks with real `mediaId`; fallback remains non-dropping with warnings.

### Gap 4: Access-control/entrypoint constraints under-specified (NFR-003/NFR-004)

**Severity:** High  
**Issue:** Plan lacked explicit verification tasks for authorized entrypoint enforcement, `overrideAccess: false` semantics with user context, and hook transaction safety (`req.payload` + `req`).  
**Fix Applied:** Added Step 11 with concrete file targets (`route.ts`, `extract-single.ts`, integration tests) and explicit acceptance criteria for authz/access/transaction safety.

### Gap 5: Plan did not fully capture privacy logging constraints

**Severity:** Medium  
**Issue:** Structured report existed, but no explicit end-to-end gate ensuring warning/error logs exclude raw prompt/HTML/SVG/answers.  
**Fix Applied:** Extended Step 11 integration checks to enforce redacted structured logging only.

## Changes Made to Plan

- Added Step 0: lossless deterministic normalization before detection/segmentation.
- Updated Step 1–5, 7–9 file paths to `src/server/payload/endpoints/exercises/v3-converter/**`.
- Updated Step 6 architecture: endpoint-layer converter orchestrator + `transform.ts` compatibility delegation.
- Updated Step 7 asset strategy: persisted asset IDs for media/svg, narrow privileged writes, safe fallback behavior.
- Added Step 11: entrypoint authorization, Local API access safety, hook transaction safety, and privacy-log gates.
- Updated File Summary and Test Commands to include normalization and security/access verification scope.
