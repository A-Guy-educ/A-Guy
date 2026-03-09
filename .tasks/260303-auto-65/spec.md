# Spec: 260303-auto-65

## Overview

Refactor duplicated `formatSlug` logic used by the Courses, Chapters, and Lessons Payload collections to use a single shared, Hebrew-safe slug formatting utility based on the existing Exercises implementation (which uses the `slugify` library with `locale: 'he'`). This ensures Hebrew titles produce valid, non-empty slugs and slug formatting is consistent across collections.

## Requirements

### FR-001: Create shared Hebrew-safe `formatSlug` utility

**Priority**: MUST  
**Description**: Add a shared utility at `src/server/payload/fields/formatSlug.ts` exporting `formatSlug(val: string): string` that matches the behavior of the current Exercises `formatSlug` implementation, including:

- Uses the `slugify` library.
- Uses Hebrew locale (`locale: 'he'`).
- Uses strict mode (removes unsupported punctuation/symbols) and produces lowercase output.
- Replaces whitespace with hyphens as per `slugify` defaults/config.
- Includes an explicit fallback when the formatted slug is empty/invalid (e.g., whitespace/punctuation-only input) to ensure a non-empty slug is returned.

### FR-002: Replace inline `formatSlug` in Courses with shared utility

**Priority**: MUST  
**Description**: Remove the copy-pasted regex-based `formatSlug` implementation in `src/server/payload/collections/Courses.ts` and import/use the shared `formatSlug` from `src/server/payload/fields/formatSlug.ts`.

### FR-003: Replace inline `formatSlug` in Chapters with shared utility

**Priority**: MUST  
**Description**: Remove the copy-pasted regex-based `formatSlug` implementation in `src/server/payload/collections/Chapters.ts` and import/use the shared `formatSlug`.

### FR-004: Replace inline `formatSlug` in Lessons with shared utility

**Priority**: MUST  
**Description**: Remove the copy-pasted regex-based `formatSlug` implementation in `src/server/payload/collections/Lessons.ts` and import/use the shared `formatSlug`.

### FR-005: Standardize Exercises to use shared utility

**Priority**: SHOULD  
**Description**: Update `src/server/payload/collections/Exercises/formatSlug.ts` to import and re-export (or directly use) the shared `formatSlug` utility so that all four collections share the same formatting behavior. The existing Exercises uniqueness/numbering behavior (e.g., suffixing `-1`, `-2`) must be preserved.

### FR-006: Backward-compatible slug behavior (no unintended slug rewrites)

**Priority**: MUST  
**Description**: Ensure the refactor does not rewrite existing stored slugs. Slugs must only be generated when a document’s slug is missing/empty (or on create), and must not be silently regenerated on update solely due to a title change.

### NFR-001: i18n correctness for Hebrew titles

**Priority**: MUST  
**Description**: Hebrew titles (including mixed Hebrew/English/numbers) must generate stable, URL-safe, non-empty slugs that preserve Hebrew characters rather than stripping them.

### NFR-002: No new external behavior changes beyond slug formatting

**Priority**: MUST  
**Description**: The change must be a refactor + Hebrew support fix only. It must not modify access control, collection slugs, relationship behavior, uniqueness constraints, publishing logic, or routing patterns.

### NFR-003: Low-risk, minimal performance impact

**Priority**: SHOULD  
**Description**: The shared `formatSlug` utility should remain a pure string transformation (no database/network calls). Existing database-based uniqueness logic (if any) remains where it is today (not moved into `formatSlug`).

### NFR-004: TypeScript-first and testability

**Priority**: SHOULD  
**Description**: The shared utility must be fully typed and easily unit-testable. If tests exist for slug formatting, they should be updated to target the shared utility.

## Acceptance Criteria

- [ ] A new shared utility exists at `src/server/payload/fields/formatSlug.ts` and is the single source of truth for slug formatting.
- [ ] Courses, Chapters, and Lessons no longer contain inline regex-based `formatSlug` implementations and instead import the shared utility.
- [ ] Exercises uses the shared utility (directly or via re-export), while preserving its existing uniqueness/suffixing behavior.
- [ ] For Hebrew-only titles (e.g., `"שלום עולם"`), generated slugs are non-empty and do not strip Hebrew characters.
- [ ] For mixed RTL/LTR titles (e.g., `"כיתה 8 - Algebra בסיסי"`), generated slugs remain non-empty and stable.
- [ ] For titles that would otherwise yield an empty slug (e.g., whitespace/punctuation-only), the shared utility returns a non-empty fallback slug.
- [ ] Existing documents’ stored slugs are not modified as part of this refactor; updates that change `title` without explicitly changing `slug` do not regenerate the slug.

## Guardrails

- Do not introduce data migrations or rewrite existing slugs in the database.
- Do not change route structures or any logic that depends on existing slugs.
- Do not change access control rules for any collection.
- Do not move existing uniqueness enforcement logic (e.g., Exercises slug suffixing) into the shared `formatSlug` utility.
- Keep changes scoped to the files listed in the task (plus any minimal test updates if applicable).

## Out of Scope

- Migrating or repairing previously created broken Hebrew slugs already stored in the database.
- Changing how slug uniqueness is enforced across collections (e.g., making Chapters/Lessons uniqueness scoped instead of global).
- Adding redirects or aliasing from old slugs to new slugs.
- Broader i18n changes outside slug generation.

## Open Questions

1. Should the Exercises collection delete its local `formatSlug` file entirely and import from the shared utility directly, or should it keep the file as a thin re-export for minimal diff?
2. Are there existing unit/integration tests around slug generation that should be updated or expanded (and where do they live)?
3. Should the fallback slug be deterministic (e.g., derived from title hash) rather than time-based, or should it exactly match the current Exercises fallback behavior?

## Domain Expert Review (@payload-expert)

- Path/pattern: Payload 3.x is flexible about utility locations; in this repo `src/server/payload/fields/` is typically used for reusable field factories, so placing a pure string utility there is acceptable but slightly semantically off. Keep the requested path for this task, but treat it explicitly as a server utility.
- Backward compatibility risk: Ensure slug generation does not unintentionally regenerate slugs on update when only the title changes; generate only on create and/or when the existing slug is missing.
- Edge cases: Include acceptance coverage for Hebrew with diacritics/niqqud, mixed RTL/LTR strings, punctuation-only titles (fallback), and control-character/punctuation quirks that could otherwise yield surprising output.
