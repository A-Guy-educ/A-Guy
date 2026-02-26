# Auditor Report: 260226-add-missing-indexes

## Task Info

- **Task ID:** 260226-add-missing-indexes
- **Task Type:** chore
- **Run State:** SUCCESS
- **Date:** 2026-02-26T17:22:27Z
- **Previous Improvements Reviewed:** 0 from audit-history.json

## Stage Analysis

| Stage | Quality |
| ------ | ------- |
| spec   | Excellent - Detailed table with exact file paths, line numbers, and field names for all 10 fields. Clear acceptance criteria. |
| plan   | Not applicable - This was a straightforward chore with no plan.md (single-step task) |
| build  | Excellent - Added all 10 indexes as specified, plus proactively wrote unit tests to verify changes. All quality gates passed on first try. |
| verify | Complete - TypeScript, Lint, Format, and Unit Tests all passed |

## Process Delta

- Task executed smoothly with no retries required
- Spec provided exact line numbers, enabling precise execution
- Build agent added value by writing unit tests (collection-indexes.spec.ts) - this is a best practice
- All quality gates passed on first attempt (TypeScript, Lint, Format, Unit Tests)

## Primary Improvement

- **Type:** AUTOMATION
- **Title:** Add index validation to CI quality gates
- **Rationale:** While this specific task was executed perfectly, missing indexes are a common performance issue that can slip through code reviews. Automating detection ensures consistency.
- **Where:** `.github/workflows/quality.yml` or similar CI configuration
- **Acceptance Criteria:**
  - Add a CI check that scans collection files for relationship/status fields lacking `index: true`
  - Run as part of the standard lint/typecheck pipeline
  - Document the expected index patterns in AGENTS.md or a new PERFORMANCE.md guide
- **Effectiveness:** neutral

## Additional Findings

1. **Type:** DOC
   - **Title:** Document database index best practices
   - **Where:** `docs/PERFORMANCE.md` (new file)
   - **Rationale:** Create a reference guide listing which field types (status selects, frequently-filtered relationships) should always have indexes for junior developers

2. **Type:** INDEX
   - **Title:** Add index checklist to collection template
   - **Where:** `.agents/skills/new-collection/SKILL.md`
   - **Rationale:** When creating new collections, prompt developers to consider adding indexes on status, owner, and commonly filtered relationship fields

3. **Type:** CODE_PATTERN
   - **Title:** Standardize index naming convention
   - **Where:** Collection configuration files
   - **Rationale:** Consider adding custom index names for clarity (e.g., `index: { name: 'statusPublished' }`) rather than relying on auto-generated names

4. **Type:** PROMPT
   - **Title:** Remind agents about indexes in feature tasks
   - **Where:** `AGENTS.md` or task generation prompts
   - **Rationale:** When agents add new status or relationship fields, remind them to consider `index: true` as part of the standard field definition

## Failure Analysis (if FAILED)

Not applicable - task completed successfully.

## Chosen Improvement (DEPRECATED - use Primary Improvement)

- **Type:** AUTOMATION
- **Title:** Add index validation to CI quality gates
- **Where:** `.github/workflows/quality.yml`
- **Rationale:** Automate detection of missing indexes to prevent performance issues from being merged
