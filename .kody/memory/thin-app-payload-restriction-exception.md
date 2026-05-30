---
name: thin-app-payload-restriction-exception
title: Thin App Payload Restriction Exception
type: decision
source: task:2113
recorded_at: 2026-05-26T14:31:56Z
---

The `no-restricted-imports` rule for Payload `getPayload` in `src/app/**` has an explicit exception for files matching `*-action.ts` or `*-action.tsx` patterns (see `eslint.config.mjs` `thin-app-payload-block` rule ignores at lines 226-228). This allows server actions to directly import `getPayload` from `payload`.

Why: Server actions (marked `'use server'`) are treated as lightweight service wrappers and are exempt from the rule requiring `@/server/services/**` alternatives.

How to apply: When creating new server actions, name them `*-action.ts` (matching the glob pattern) and place them in an `actions/` subdirectory. This automatically exempts them from the getPayload restriction.

**Why:** The existing auth-action.ts and admin-reset-password-action.ts both use direct getPayload and pass lint. The naming convention matters for the ESLint ignore pattern.

**Source task:** `2113`
