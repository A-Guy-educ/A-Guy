# Task

## Issue Title

Bug: 30+ console.log debug statements in V2 exercise conversion pipeline
## Description

The V2 exercise conversion services contain 30+ `console.log`/`console.warn` statements that log per-line OCR/text extraction data to stdout in production. For a typical multi-page PDF, this generates hundreds of log lines per conversion job.

The project has a proper structured logger (`@/infra/utils/logger`) based on Pino, but the V2 conversion pipeline uses raw `console.log` instead.

## Current Behavior

```typescript
// Scattered across conversion services:
console.log('Extracted text:', text)
console.log('OCR result:', result)
console.warn('Detection failed:', error)
```

This creates noise in production logs, lacks log levels, and cannot be filtered or structured.

## Expected Behavior

Replace all `console.log`/`console.warn` with the project's structured logger:

```typescript
import { logger } from '@/infra/utils/logger'

logger.debug({ text }, 'Extracted text')  // per-line details
logger.info({ pages }, 'PDF extraction complete')  // summaries
logger.warn({ error }, 'Detection failed')  // warnings
```

## Files to Change

- `src/server/services/exercise-conversion/v2/vision-text-combo-service.ts` (8 console.log calls)
- `src/server/services/exercise-conversion/v2/text-detection-service.ts` (12+ console.log calls)
- `src/server/services/exercise-conversion/v2/ocr-detection-service.ts` (10+ console.log calls)
- `src/app/api/jobs/run-immediate/route.ts` (4 console.log calls)
- `src/app/api/exercises/import/route.ts` (2 console.log calls)

## Complexity

Medium — 5 files, mechanical replacement of console.log with structured logger calls using appropriate log levels.

## Labels

bug, performance, logging
