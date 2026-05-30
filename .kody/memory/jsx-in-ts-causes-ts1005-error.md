---
name: jsx-in-ts-causes-ts1005-error
title: Jsx In Ts Causes Ts1005 Error
type: lesson
source: task:2133
recorded_at: 2026-05-28T12:06:29Z
---

When creating React email template components inline in a service file, TypeScript throws `error TS1005: '>' expected` if the file is named `.ts`. JSX requires a `.tsx` extension.
Fix: rename the file from `purchase-receipt-service.ts` to `purchase-receipt-service.tsx`.

**Why:** TypeScript only allows JSX syntax in files with the .tsx extension. Using .ts causes a cryptic parse error at the first JSX element.

**Source task:** `2133`
