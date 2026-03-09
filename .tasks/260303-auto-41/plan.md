# Plan: Replace console.log with Structured Logger in V2 Exercise Conversion Pipeline

**Task ID**: 260303-auto-41
**Task Type**: refactor
**Spec**: Replace all `console.log`/`console.warn` statements in 5 files with the project's Pino-based structured logger (`@/infra/utils/logger`)

---

## Assumptions

1. The structured logger at `@/infra/utils/logger` exports `logger` (Pino instance) and `createRequestLogger`. We use the `logger` singleton directly (no request context needed in these services).
2. `console.error` in catch blocks is also replaced with `logger.error` for consistency (spec mentions console.* should not remain).
3. Per-line detailed logging (individual text lines, snap details) maps to `logger.debug()`. Summary messages (page-level counts, completion) map to `logger.info()`. Warnings map to `logger.warn()`. Errors map to `logger.error()`.
4. Context objects follow Pino convention: `logger.info({ key: value }, 'message string')` — structured data as first arg, message as second.

---

## Step 1: Replace console statements in `vision-text-combo-service.ts`

**Time**: ~10 minutes
**Files to Touch**:
- `src/server/services/exercise-conversion/v2/vision-text-combo-service.ts` (MODIFIED — lines 18, 53-58, 75, 84-86, 93-95)

**Behavior**:
- Add `import { logger } from '@/infra/utils/logger'` at top of file (after existing imports, ~line 25)
- Line 53-55: `console.log` summary → `logger.info({ pageIndex, exerciseCount: visionResult.exercises.length, continuesFromPrevious: visionResult.continuesFromPrevious }, '[V2-Combo] Vision LLM detection results')`
- Lines 56-58: `console.log` per-exercise detail → `logger.debug({ pageIndex, label: ex.label, approxY: ex.startY }, '[V2-Combo] Vision detection')`
- Line 75: `console.log` no text lines → `logger.debug({ pageIndex }, '[V2-Combo] No text lines, using Vision positions directly')`
- Lines 84-86: `console.log` snap success → `logger.debug({ pageIndex, label: visionEx.label, fromY: visionEx.startY, toY: snapped.startY, matchedLine: snapped.matchedLineText }, '[V2-Combo] Snapped exercise position')`
- Lines 93-95: `console.log` snap fallback → `logger.debug({ pageIndex, label: visionEx.label, y: visionEx.startY }, '[V2-Combo] No snap available, using Vision position')`

**Tests** (1 test file: `tests/unit/services/v2-combo-logger.spec.ts`, NEW):
1. **Test: "vision-text-combo-service uses structured logger instead of console.log"**
   - Read the source file content
   - Assert: file does NOT contain `console.log` or `console.warn`
   - Assert: file DOES contain `import { logger } from '@/infra/utils/logger'`
   - Assert: file DOES contain calls to `logger.info(` and `logger.debug(`
   - **FAILS before**: file contains `console.log`
   - **PASSES after**: all console.log replaced

**Acceptance Criteria**:
- [ ] `import { logger } from '@/infra/utils/logger'` present in file
- [ ] Zero `console.log` or `console.warn` statements in file
- [ ] 6 logger calls present (1 `logger.info`, 5 `logger.debug`)
- [ ] Each logger call passes context object as first argument
- [ ] TypeScript compiles without errors (`pnpm tsc --noEmit`)

---

## Step 2: Replace console statements in `text-detection-service.ts`

**Time**: ~15 minutes
**Files to Touch**:
- `src/server/services/exercise-conversion/v2/text-detection-service.ts` (MODIFIED — lines 12-13, 75-89, 104-106, 126-128)

**Behavior**:
- Add `import { logger } from '@/infra/utils/logger'` at top of file
- Line 75: `console.log` summary → `logger.info({ pageIndex, lineCount: lines.length }, '[V2-TextDetect] Text lines extracted')`
- Lines 77-79 (loop ≤30 lines): `console.log` per-line detail → `logger.debug({ pageIndex, y: line.y, text: line.text.substring(0, 80) }, '[V2-TextDetect] Text line')`
- Lines 82-84 (first 10 of >30 lines): same `logger.debug` pattern
- Line 85: `console.log` ellipsis → `logger.debug({ pageIndex, omittedCount: lines.length - 15 }, '[V2-TextDetect] Omitted lines')`
- Lines 86-88 (last 5 of >30 lines): same `logger.debug` pattern
- Lines 104-106: `console.log` filter summary → `logger.info({ pageIndex, contentLineCount: contentLines.length }, '[V2-TextDetect] Content lines after header/footer filter')`
- Lines 126-128: `console.log` match → `logger.debug({ pageIndex, label: match.label, y: line.y, text: line.text.substring(0, 60) }, '[V2-TextDetect] Matched exercise')`

**Tests** (same test file `tests/unit/services/v2-combo-logger.spec.ts`, expanded):
1. **Test: "text-detection-service uses structured logger instead of console.log"**
   - Read source file content
   - Assert: file does NOT contain `console.log` or `console.warn`
   - Assert: file DOES contain `import { logger } from '@/infra/utils/logger'`
   - Assert: file contains `logger.info(` and `logger.debug(`
   - **FAILS before**: file contains `console.log`
   - **PASSES after**: all replaced

**Acceptance Criteria**:
- [ ] `import { logger } from '@/infra/utils/logger'` present
- [ ] Zero `console.log`/`console.warn` in file
- [ ] Summary lines use `logger.info()`, per-line details use `logger.debug()`
- [ ] Context objects include `pageIndex` for correlation
- [ ] TypeScript compiles without errors

---

## Step 3: Replace console statements in `ocr-detection-service.ts`

**Time**: ~15 minutes
**Files to Touch**:
- `src/server/services/exercise-conversion/v2/ocr-detection-service.ts` (MODIFIED — lines 12-14, 59-71, 92-94)

**Behavior**:
- Add `import { logger } from '@/infra/utils/logger'` at top of file
- Line 59: `console.log` summary → `logger.info({ pageIndex, lineCount: lines.length }, '[V2-OCR] OCR lines extracted')`
- Lines 61-63 (loop ≤30): `console.log` → `logger.debug({ pageIndex, y: line.y, text: line.text.substring(0, 80) }, '[V2-OCR] OCR line')`
- Lines 65-67 (first 10 of >30): same `logger.debug` pattern
- Line 68: `console.log` ellipsis → `logger.debug({ pageIndex, omittedCount: lines.length - 15 }, '[V2-OCR] Omitted lines')`
- Lines 69-71 (last 5 of >30): same `logger.debug` pattern
- Lines 92-94: `console.log` match → `logger.debug({ pageIndex, label: match.label, y: line.y, text: line.text.substring(0, 60) }, '[V2-OCR] Matched exercise')`

**Tests** (same test file, additional test):
1. **Test: "ocr-detection-service uses structured logger instead of console.log"**
   - Read source file content
   - Assert: file does NOT contain `console.log` or `console.warn`
   - Assert: file DOES contain `import { logger } from '@/infra/utils/logger'`
   - **FAILS before**: file contains `console.log`
   - **PASSES after**: all replaced

**Acceptance Criteria**:
- [ ] `import { logger } from '@/infra/utils/logger'` present
- [ ] Zero `console.log`/`console.warn` in file
- [ ] Pattern matches OCR service (same info/debug split as text-detection)
- [ ] TypeScript compiles without errors

---

## Step 4: Replace console statements in `run-immediate/route.ts`

**Time**: ~10 minutes
**Files to Touch**:
- `src/app/api/jobs/run-immediate/route.ts` (MODIFIED — lines 1-8, 108, 111, 113, 151, 159, 172)

**Behavior**:
- Add `import { logger } from '@/infra/utils/logger'` at top of file
- Line 108: `console.log` → `logger.info({ jobId }, '[run-immediately] Executing job synchronously')`
- Line 111: `console.log` → `logger.debug('[run-immediately] Loading runtime config...')`
- Line 113: `console.log` → `logger.debug('[run-immediately] Runtime config loaded')`
- Line 151: `console.log` → `logger.info({ jobId }, '[run-immediately] Job completed successfully')`
- Line 159: `console.error` → `logger.error({ err: error }, '[run-immediately] Error')`
- Line 172: `console.error` → `logger.error({ err: updateError }, '[run-immediately] Failed to update job status')`

**Tests** (same test file, additional test):
1. **Test: "run-immediate route uses structured logger instead of console"**
   - Read source file content
   - Assert: file does NOT contain `console.log`, `console.warn`, or `console.error`
   - Assert: file DOES contain `import { logger } from '@/infra/utils/logger'`
   - Assert: file contains `logger.info(`, `logger.debug(`, and `logger.error(`
   - **FAILS before**: file contains `console.log` and `console.error`
   - **PASSES after**: all replaced

**Acceptance Criteria**:
- [ ] `import { logger } from '@/infra/utils/logger'` present
- [ ] Zero `console.log`/`console.warn`/`console.error` in file
- [ ] `console.error` calls replaced with `logger.error()` passing error object as `{ err: error }`
- [ ] Job lifecycle uses `logger.info()`, config loading uses `logger.debug()`
- [ ] TypeScript compiles without errors

---

## Step 5: Replace console statements in `exercises/import/route.ts`

**Time**: ~10 minutes
**Files to Touch**:
- `src/app/api/exercises/import/route.ts` (MODIFIED — lines 9-14, 41, 44, 48)

**Behavior**:
- Add `import { logger } from '@/infra/utils/logger'` at top of file
- Line 41: `console.log` → `logger.info({ lessonId }, '[API Route] Calling importExerciseFromLesson')`
- Line 44: `console.log` → `logger.info('[API Route] Calling importExerciseFromImage')`
- Line 48: `console.error` → `logger.error({ err: error }, '[API Route] Error in /api/exercises/import')`

**Tests** (same test file, additional test):
1. **Test: "exercises import route uses structured logger instead of console"**
   - Read source file content
   - Assert: file does NOT contain `console.log`, `console.warn`, or `console.error`
   - Assert: file DOES contain `import { logger } from '@/infra/utils/logger'`
   - **FAILS before**: file contains `console.log` and `console.error`
   - **PASSES after**: all replaced

**Acceptance Criteria**:
- [ ] `import { logger } from '@/infra/utils/logger'` present
- [ ] Zero `console.log`/`console.warn`/`console.error` in file
- [ ] TypeScript compiles without errors

---

## Step 6: Integration verification — all 5 files clean

**Time**: ~5 minutes
**Files to Touch**: None (verification only)

**Tests** (same test file, final integration test):
1. **Test: "all 5 target files have zero console.* statements"**
   - For each of the 5 files, read contents
   - Assert: no file contains `console.log(`, `console.warn(`, or `console.error(`
   - Assert: all 5 files contain the logger import
   - **FAILS before**: at least one file still has console.*
   - **PASSES after**: all clean

2. **Test: "all 5 target files pass Pino structured logging convention"**
   - For each logger call in each file, verify the pattern `logger.<level>({ ... }, 'message')` or `logger.<level>('message')` is used (no template literal string as first arg without context)
   - **FAILS before**: console.log uses string interpolation
   - **PASSES after**: Pino convention followed

**Acceptance Criteria**:
- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] All 5 files have zero `console.*` statements
- [ ] All 5 files import from `@/infra/utils/logger`
- [ ] Structured context objects passed where data is available (pageIndex, jobId, etc.)

---

## Test File Structure

All tests go in a single file: `tests/unit/services/v2-logger-refactor.spec.ts` (NEW)

```
describe('Logger Refactor - V2 Exercise Conversion Pipeline')
  describe('vision-text-combo-service.ts')
    it('uses structured logger instead of console.log')
  describe('text-detection-service.ts')
    it('uses structured logger instead of console.log')
  describe('ocr-detection-service.ts')
    it('uses structured logger instead of console.log')
  describe('run-immediate/route.ts')
    it('uses structured logger instead of console statements')
  describe('exercises/import/route.ts')
    it('uses structured logger instead of console statements')
  describe('all target files')
    it('have zero console.* statements')
    it('all import from @/infra/utils/logger')
```

These are static analysis tests (reading file content) — they are fast, deterministic, and don't require mocking. They verify the contract: "no console.* in these files, logger imported and used."

---

## Logger Level Mapping Summary

| Original Statement | Logger Level | Rationale |
|---|---|---|
| `console.log` per-line text details | `logger.debug()` | Verbose per-item debugging |
| `console.log` page-level summaries | `logger.info()` | Operational visibility |
| `console.log` matched exercises | `logger.debug()` | Detailed detection logging |
| `console.log` snap details | `logger.debug()` | Detailed processing steps |
| `console.log` job lifecycle events | `logger.info()` | Operational visibility |
| `console.log` config loading | `logger.debug()` | Internal process details |
| `console.log` API route handler | `logger.info()` | Request handling visibility |
| `console.warn` | `logger.warn()` | Warning (none currently in target files) |
| `console.error` | `logger.error({ err })` | Errors with Pino err serializer |

---

## Validation Commands

```bash
# After all changes:
pnpm tsc --noEmit                    # TypeScript compiles
pnpm vitest run tests/unit/services/v2-logger-refactor.spec.ts  # Tests pass
```
