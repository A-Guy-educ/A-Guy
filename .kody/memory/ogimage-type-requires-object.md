---
name: ogimage-type-requires-object
title: Ogimage Type Requires Object
type: lesson
source: task:1576
recorded_at: 2026-05-23T18:09:44Z
---

Next.js Metadata types OGImage = string | {url, alt, ...} | URL. When building images arrays for openGraph/twitter metadata, always use {url: string} object form — not raw string — so callers can access .url on array elements without type errors.

**Why:** A string URL in an images array would make images[0].url undefined at runtime even though TypeScript allows the access.

**Source task:** `1576`
