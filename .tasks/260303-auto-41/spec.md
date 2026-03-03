# Replace console.log with Structured Logger in V2 Exercise Conversion Pipeline

## Overview

Replace all `console.log`/`console.warn` statements in the V2 exercise conversion services with the project's structured logger (`@/infra/utils/logger` - Pino-based).

## Requirements

### FR-1: Import Logger
- Import the logger from `@/infra/utils/logger` in all affected files

### FR-2: Replace Console Statements
- Replace `console.log` with appropriate logger methods:
  - Per-line details → `logger.debug()`
  - Summaries → `logger.info()`
  - Warnings → `logger.warn()`
- Replace `console.warn` with `logger.warn()`

### FR-3: Maintain Context
- Pass relevant data as context objects to logger methods for structured output

## Files to Modify

1. `src/server/services/exercise-conversion/v2/vision-text-combo-service.ts` (8 console.log calls)
2. `src/server/services/exercise-conversion/v2/text-detection-service.ts` (12+ console.log calls)
3. `src/server/services/exercise-conversion/v2/ocr-detection-service.ts` (10+ console.log calls)
4. `src/app/api/jobs/run-immediate/route.ts` (4 console.log calls)
5. `src/app/api/exercises/import/route.ts` (2 console.log calls)

## Acceptance Criteria

- [ ] All console.log statements replaced with logger.debug() or logger.info()
- [ ] All console.warn statements replaced with logger.warn()
- [ ] Logger imported in all 5 files
- [ ] Context objects passed to logger for structured output
- [ ] No console.* statements remain in these files
