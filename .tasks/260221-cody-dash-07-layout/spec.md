# TASK-07: Cody Route Group Layout & Page

## Summary
Create the (cody) route group with its own HTML layout, Tailwind CSS, CopilotKit provider, and auth-gated page.

## Task Type
implement_feature

## Dependencies
- TASK-01 (spike result — determines Gemini vs OpenAI adapter)

## Requirements

### R1: Create (cody) layout
- File: `src/app/(cody)/layout.tsx`
- Server component (default)
- Own `<html>` and `<body>` tags (required — no shared root layout)
- Import Tailwind CSS: `import '@/app/(frontend)/globals.css'` (reuse existing)
- Import Geist fonts (same pattern as frontend layout but simplified)
- No i18n, no locale — English only
- No Header/Footer — clean dashboard layout
- Metadata: `title: 'Cody Dashboard'`

### R2: Create page with auth gate
- File: `src/app/(cody)/cody/page.tsx`
- Client component (`'use client'`)
- Use own auth check: read `cody-session` cookie, redirect to `/cody/login` if missing
- Loading state: show spinner while checking auth (simple div with animate-spin)
- Not authenticated: redirect to `/cody/login`
- No admin role check needed — CODY_DASHBOARD_SECRET is the only gate
- Authenticated admin: render `<CopilotKit runtimeUrl="/api/copilotkit">` wrapper around `<CodyDashboard />`

### R3: CodyDashboard shell
- File: `src/ui/admin/CodyDashboard/index.tsx`
- Client component
- For now: placeholder that says "Cody Operations Dashboard" with a heading
- Will be filled in by TASK-08 (kanban board)

### R4: Update from spike
- If TASK-01 created spike files at these paths, upgrade them
- If TASK-01 used different paths, move files to correct locations
- Remove any spike-only test code (like the getCurrentTime action)

## Files to Create/Modify
- `src/app/(cody)/layout.tsx` (NEW or MODIFIED from spike)
- `src/app/(cody)/cody/page.tsx` (NEW or MODIFIED from spike)
- `src/ui/admin/CodyDashboard/index.tsx` (NEW)

## Acceptance Criteria
- [ ] `/cody` loads in the browser
- [ ] Unauthenticated users are redirected to `/cody/login`
- [ ] Wrong password shows error message
- [ ] Admin users see the CodyDashboard placeholder
- [ ] Page has its own `<html>` tags (not nested in frontend layout)
- [ ] Tailwind classes work
- [ ] `pnpm tsc --noEmit` passes

## Notes
- Reference `src/app/(frontend)/layout.tsx` for the layout pattern but keep it much simpler
- No Payload dependency — auth is via CODY_DASHBOARD_SECRET cookie set by /cody/login page
- The CopilotKit provider wraps the entire dashboard so chat can access actions from any component

### R5: Login page
- File: `src/app/(cody)/cody/login/page.tsx`
- Simple password input form
- Submit → POST `/api/cody/auth` with password
- API checks password against `CODY_DASHBOARD_SECRET` env var
- If match: sets `cody-session` cookie, returns 200
- If wrong: returns 401
- On success: redirect to `/cody`
- File: `src/app/api/cody/auth/route.ts` — POST handler for login
