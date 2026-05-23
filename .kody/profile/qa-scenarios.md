---
for: qa
---

# QA scenarios

Route map and critical user flows for QA. This is what `qa-engineer` should
exercise when browsing the app; auth is the configured QA account
(email + password) at `/login`.

## Key routes

**Learner / public**
- `/` home · `/:slug` tenant landing · `/start` · `/onboarding/persona`
- `/courses` · `/courses/:courseSlug` · `/courses/:courseSlug/chapters/:chapterSlug`
- Lesson: `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug`
  (+ `/content/:pageSlug`, `/exercises/:exerciseSlug`, `/complete`)
- `/exercises/:id` · `/practice` · `/search` · `/posts` · `/posts/:slug` ·
  `/account` · `/ask` · `/offline`

**Auth**: `/login` · `/signup`

**Admin**: `/admin/:[...segments]` · `/admin/chat` · `/admin/pdf-conversion`

## Critical flows (verify these first)

1. **Exercise page** — navigate lesson → exercise; exercise interactions render;
   page metadata correct; 404 for a non-existent exercise and for an exercise
   that doesn't belong to the lesson; mobile header navigation works.
2. **Lesson duplication review (admin)** — open the review screen for a
   `needs_review` record; failures list shows action buttons; Skip → pending
   indicator; Keep → marks resolved + success banner; full flow: diff preview →
   2× regenerate → skip → looks_right → succeeded.
3. **Admin dashboard widgets** — Course Enrollments widget (title, per-course
   progress bars, "view all" expands when >5 courses); Registered Users card
   (total shown prominently).
4. **Chat + memory** — extracts and persists user preferences from a
   conversation; context holds across multiple messages; retrieves memories
   from prior conversations; behaves gracefully when there are none;
   long conversations auto-summarize; **tenant isolation — never leak memories
   between users**; chat and network errors degrade gracefully.
5. **PDF embed** — a blocked (X-Frame-Options) URL surfaces a working download
   button.
6. **Course selection / frontend / version footer** — landing and course
   selection render; footer shows the current version.

## Cross-cutting checks

- **Auth-gated surfaces**: admin routes require the admin role; note as a gap
  if the QA account can't reach them.
- **Mobile**: re-check exercise, lesson, and admin surfaces at ~375px wide.
- **Multi-tenant**: no cross-tenant data leakage anywhere, especially chat memory.

> Scenario titles distilled from the repo's `tests/e2e/*.e2e.spec.ts` suite and
> the app route inventory. Keep this concise — it's injected into chat context.
