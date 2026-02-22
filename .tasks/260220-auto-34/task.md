# Task

## Description
Approximately 65 `console.log` statements exist in production source code that should either use the structured Pino logger or be removed. They pollute server logs and can leak internal data.

## Hotspots
| Area | Files | Count |
|------|-------|-------|
| V2 pipeline services | text-detection-service.ts, vision-text-combo-service.ts, ocr-detection-service.ts | ~18 |
| V2 job task | pdf-to-exercises-v2-task.ts | 8 |
| Analytics infra | tracker.ts, system-events-subscriber.ts, mixpanel/adapter.ts, ga4/adapter.ts, config.ts | ~20 |
| API routes | run-immediate/route.ts, exercises/import/route.ts | ~6 |
| Admin UI | CommandPalette.tsx (2), GA4Scripts.tsx (1) | 3 |
| V1 job task | pdf-to-exercises-task.ts | 2 |

## Expected Fix
- **Server-side**: Replace with `req.payload.logger.info()` or `logger.info()` (Pino)
- **Analytics**: Gate behind `NODE_ENV === 'development'` check or use logger
- **Client-side**: Remove or replace with conditional `if (process.env.NODE_ENV === 'development')` 

## Priority
LOW — Code hygiene, not user-facing but reduces log noise
