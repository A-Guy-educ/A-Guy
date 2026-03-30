All 8 findings are resolved. Here's the summary:

### Changes Made

**1. `/api/copilotkit` — User authentication added**
- Refactored POST handler to use `withApiHandler` with `auth: 'authenticated'`
- Added Zod schema validation for request body
- Unauthenticated users now get a 401 response

**2. Four cron routes — CRON_SECRET validation at route level (defense-in-depth)**
- `/api/cron/chat-asset-expiry`
- `/api/cron/guest-sessions-cleanup`
- `/api/cron/media-expiry`
- `/api/cron/upload-session-cleanup`

Each now validates `Authorization: Bearer {CRON_SECRET}` before forwarding to the Payload endpoint handler. Previously auth only happened inside the downstream `withCronMiddleware`.

**3. Three routes — False positives (already authenticated)**
- `/api/exercises/convert/single` — already uses `withApiHandler` with `auth: 'admin'`
- `/api/exercises/convert/single/create` — already uses `withApiHandler` with `auth: 'admin'`
- `/api/lessons/convert-context` — already uses `withApiHandler` with `auth: 'admin'`
