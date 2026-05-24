# Fix: Exercise listing shows orphaned records with no Lesson or Tenant (issue #1983)

## What I Fixed

Modified the `beforeChange` hook in `src/server/payload/collections/Exercises/index.ts` to populate `tenant` from the lesson's `tenant` when creating exercises without an explicit tenant.

## Root Cause

When exercises are created via the lesson duplication orchestrator (`createOutputExercise` in `orchestrator.ts`), they are created with `lesson: outputLessonId` but no explicit `tenant`. The `tenantField`'s `beforeValidate` hook would set the **default** tenant (from `DEFAULT_TENANT_SLUG`), not the tenant from the related lesson.

## Change Made

In the `beforeChange` hook (lines 59-98), I:
1. Added `tenant` to the `select` statement when fetching the lesson: `select: { chapter: true, tenant: true }`
2. Added logic to populate `data.tenant` from `lesson.tenant` if tenant is not already set

This ensures exercises get the correct tenant from their lesson, consistent with how `chapter` and `course` are already populated.

## Files Touched

- `src/server/payload/collections/Exercises/index.ts` — modified `beforeChange` hook

## Verification

- Typecheck passes
- Lint passes
- The `mcp__kody-verify__verify` tool returned `ok: true`
