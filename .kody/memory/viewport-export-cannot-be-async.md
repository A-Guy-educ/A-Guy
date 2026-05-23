---
name: viewport-export-cannot-be-async
title: Viewport Export Cannot Be Async
type: lesson
source: task:1576
recorded_at: 2026-05-23T18:09:44Z
---

The `export const viewport` in Next.js layout cannot be an async function. Brand-driven themeColor values in viewport must remain hardcoded (matching brand config) until Next.js supports async viewport exports or multi-brand static generation is addressed (Phase 3).

**Why:** Attempting to use getBrand() in an async viewport export would fail at static generation time when no request context is available.

**Source task:** `1576`
