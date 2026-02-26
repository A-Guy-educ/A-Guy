# Apply Audit Report: 260226-add-missing-indexes

## Improvements Applied

| #   | Type         | Where                              | Status              |
| --- | ------------ | ---------------------------------- | ------------------- |
| 1   | SKILL        | .agents/skills/new-collection/SKILL.md | status: IMPLEMENTED |
| 2   | PROMPT       | AGENTS.md                          | status: IMPLEMENTED |

## Changes Made

### 1. .agents/skills/new-collection/SKILL.md (status: IMPLEMENTED)

Added a comprehensive **Index Checklist** section that prompts developers to consider indexes when creating new collections:

- **Required Indexes**: Status fields, owner/relationship fields, slug fields
- **Common Indexes**: Foreign keys, sortable fields, date fields
- **Code examples** showing proper index usage

This addresses **Additional Finding #2** from the auditor: "Add index checklist to collection template"

### 2. AGENTS.md (status: IMPLEMENTED)

Enhanced the **Database Indexes** section in Best Practices:

- Added detailed code examples for index usage on common field types
- Documented which field types typically need indexes:
  - Status/state select fields
  - Owner/user relationship fields
  - Slug fields
  - Frequently sorted fields
  - Date fields used in range queries

This addresses **Additional Finding #4** from the auditor: "Remind agents about indexes in feature tasks"

## Suggested Improvements (Not Applied)

### 1. AUTOMATION: Add index validation to CI quality gates
- **Where:** `.github/workflows/quality.yml`
- **Reason:** This path is in the safe-path whitelist as "suggest-only" - CI/CD workflows should be reviewed by humans before implementation
- **Suggestion:** Add a CI check that scans collection files for relationship/status fields lacking `index: true`, running as part of the standard lint/typecheck pipeline

### 2. DOC: Document database index best practices
- **Where:** `docs/PERFORMANCE.md` (new file)
- **Reason:** The `docs/**` path is not in the safe-path whitelist (only `.ai-docs/**` is allowed for documentation)
- **Suggestion:** Create a new PERFORMANCE.md guide specifically listing which field types should always have indexes for junior developers

### 3. CODE_PATTERN: Standardize index naming convention
- **Where:** Collection configuration files (`src/collections/*.ts`)
- **Reason:** The `src/**` path is not in the safe-path whitelist - production code changes require proper implementation workflow
- **Suggestion:** Consider adding custom index names for clarity (e.g., `index: { name: 'statusPublished' }`) rather than relying on auto-generated names

## Notes

- Both implemented improvements directly address process documentation gaps identified by the auditor
- The new-collection skill now proactively prompts developers about indexes, preventing future performance issues
- AGENTS.md now has clear guidance on when and how to add database indexes, accessible to all AI agents working on the project
