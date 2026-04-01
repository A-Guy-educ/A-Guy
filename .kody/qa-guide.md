# QA Guide

## Authentication

- Login page: `/login`

### Test Accounts

<!-- Fill in your test/preview environment credentials below -->

| Role  | Email                      | Password |
| ----- | -------------------------- | -------- |
| Admin | aguy.aharon.yair@gmail.com | As121212 |

### Login Steps

1. Navigate to `/login`
2. Enter credentials from the test accounts table above
3. Submit the login form
4. Verify redirect to dashboard or home page

### Auth Files

- `middleware.ts`
- `src/app/api/oauth`

## Key Pages

### Frontend

- `/`
- `/:slug`
- `/account`
- `/ask`
- `/courses`
- `/courses/:courseSlug`
- `/courses/:courseSlug/chapters/:chapterSlug`
- `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug`
- `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/complete`
- `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/content/:pageSlug`
- `/courses/:courseSlug/chapters/:chapterSlug/lessons/:lessonSlug/exercises/:exerciseSlug`
- `/exercises/:id`
- `/offline`
- `/onboarding/persona`
- `/posts`
- `/posts/:slug`
- `/posts/page/:pageNumber`
- `/practice`
- `/search`
- `/start`
- ... and 5 more

### Api

- `/api-status`

### Auth

- `/login`
- `/signup`

### Admin

- `/admin/:[...segments]`
- `/admin/chat`
- `/admin/pdf-conversion`

## Dev Server

- Command: `pnpm dev`
- URL: `http://localhost:3000`
