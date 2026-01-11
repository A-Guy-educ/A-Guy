# Code Quality Boundaries - Implementation Plan

**Status:** Ready for Implementation
**Created:** 2026-01-09
**Complexity:** High
**Estimated Effort:** 3-5 days

---

## Executive Summary

This plan implements **hard enforcement** of architectural zone boundaries in the A-Guy codebase to eliminate code sprawl, unclear dependencies, and server/client leakage. The implementation will:

1. Convert existing custom ESLint plugin from CommonJS to ESM
2. Implement comprehensive zone boundary enforcement rules
3. Refactor existing violations (role constants, imports)
4. Integrate with existing CI/CD pipeline
5. Provide zero-tolerance enforcement (no grace period)

**Impact:** All illegal imports will fail builds immediately. Any server code in client bundles will be blocked. Clear architectural boundaries will be enforced automatically.

---

## Zone Definitions & Directory Mapping

### Zone 1: APP (Next.js Routing Layer)
**Paths:**
- `src/app/**`

**Can import:**
- UI, LIB, SERVICES, UTILS, DOMAIN, I18N

**Cannot import:**
- SERVER

---

### Zone 2: UI (React Rendering Layer)
**Paths:**
- `src/components/**`
- `src/blocks/**`
- `src/heros/**`
- `src/providers/**`
- `src/Header/**`
- `src/Footer/**`
- `src/search/**` (NEW - mapped from codebase)

**Can import:**
- DOMAIN, UTILS, I18N, UI-safe LIB only

**Cannot import:**
- SERVER, SERVICES, `lib/ai/**`, `lib/queries/**`, any `*.server.*`

**UI-safe LIB allowlist:**
- `lib/errors.ts`
- `lib/feature-flags.ts`
- `lib/logger/client-logger.ts` (if exists)
- Additional files can be explicitly whitelisted

---

### Zone 3: SERVER (Payload/Backend Layer)
**Paths:**
- `src/collections/**`
- `src/endpoints/**`
- `src/access/**` (NEW - mapped)
- `src/fields/**` (NEW - mapped)
- `src/hooks/**`
- `src/plugins/**` (NEW - mapped)
- `src/payload.config.ts`

**Can import:**
- DOMAIN, LIB (server-only), SERVICES, UTILS, I18N

**Cannot import:**
- UI, APP

---

### Zone 4: DOMAIN (Shared Contracts)
**Paths:**
- `src/contracts/**`
- `src/types/**` (NEW - mapped)
- `src/payload-types.ts`

**Can import:**
- Nothing (pure domain layer)

**Cannot import:**
- Any other zone

---

### Zone 5: LIB (Business Logic)
**Paths:**
- `src/lib/**`

**Sub-zones:**
- **Server-only:** `lib/ai/**`, `lib/queries/**`, `*.server.*`
- **UI-safe:** Explicitly whitelisted files only

**Server-only lib can import:**
- DOMAIN, SERVICES, UTILS, I18N, other LIB

**UI-safe lib can import:**
- DOMAIN, UTILS, I18N

---

### Zone 6: SERVICES (Application Services)
**Paths:**
- `src/services/**`

**Can import:**
- DOMAIN, LIB (server-only), UTILS

**Cannot import:**
- UI, APP

---

### Zone 7: UTILS (Pure Utilities)
**Paths:**
- `src/utilities/**`

**Can import:**
- DOMAIN, I18N

**Cannot import:**
- APP, UI, SERVER, SERVICES, LIB (except `utilities/logger/**` may import limited LIB)

---

### Zone 8: I18N (Internationalization)
**Paths:**
- `src/i18n/**`
- `messages/**` (outside src/)

**Can import:**
- Nothing (pure i18n layer)

**Cannot import:**
- Any zone

---

## Implementation Phases

### Phase 1: ESLint Plugin Conversion to ESM
**Goal:** Convert eslint-plugin-aguy from CommonJS to ESM

**Files to modify:**
- `eslint-plugin-aguy/package.json` - Add `"type": "module"`
- `eslint-plugin-aguy/index.js` - Convert to ESM syntax
- `eslint-plugin-aguy/lib/**/*.js` - Convert all rule files to ESM
- `eslint-plugin-aguy/tests/**/*.js` - Convert test files to ESM

**Changes required:**
```javascript
// OLD (CommonJS)
module.exports = { rules: { ... } }
const rule = require('./lib/rules/enforce-boundaries')

// NEW (ESM)
export default { rules: { ... } }
import rule from './lib/rules/enforce-boundaries.js'
```

**Testing:**
- Run existing unit tests with ESM
- Verify plugin loads in Next.js flat config
- Test integration with eslint.config.mjs

**Acceptance:**
- All 4 existing rules pass tests
- Plugin successfully imports in main ESLint config
- No CommonJS require() statements remain

---

### Phase 2: Implement Zone Boundary Rule
**Goal:** Create enforce-boundaries ESLint rule

**New file:** `eslint-plugin-aguy/lib/rules/enforce-boundaries.js`

**Rule architecture:**

```javascript
// Zone configuration structure
const ZONES = {
  APP: {
    patterns: ['src/app/**'],
    canImport: ['UI', 'LIB', 'SERVICES', 'UTILS', 'DOMAIN', 'I18N'],
    cannotImport: ['SERVER']
  },
  UI: {
    patterns: ['src/components/**', 'src/blocks/**', ...],
    canImport: ['DOMAIN', 'UTILS', 'I18N'],
    cannotImport: ['SERVER', 'SERVICES'],
    cannotImportPaths: ['lib/ai/**', 'lib/queries/**', '**/*.server.*']
  },
  // ... all zones
}

const UI_SAFE_LIB = [
  'lib/errors.ts',
  'lib/feature-flags.ts',
  // explicit allowlist
]
```

**Implementation strategy:**

1. **Zone detection:**
   - Use micromatch to match file path against zone patterns
   - Cache zone lookups for performance
   - Handle edge cases (tests, scripts)

2. **Import analysis:**
   - Parse ImportDeclaration and ImportExpression AST nodes
   - Resolve import paths using path.resolve
   - Detect deep imports (e.g., `collections/Users/roles`)
   - Check for *.server.* and *.client.* patterns

3. **Violation reporting:**
   - Specific error messages per violation type
   - Include zone names and allowed alternatives
   - Suggest fixes where possible

4. **Special cases:**
   - "use client" files get stricter server import checks
   - "use server" files can import server zones
   - Test files may have relaxed rules (optional)

**Error message examples:**
```
❌ UI zone cannot import from SERVER zone
   File: src/components/UserBadge.tsx
   Import: @/collections/Users/roles
   Suggestion: Move shared constants to @/types/roles

❌ Client component cannot import server-only module
   File: src/components/ChatWindow.tsx
   Import: @/lib/queries/getMessages
   Suggestion: Create a server action or API route
```

**Testing requirements:**
- Test each zone's allowed/forbidden imports
- Test "use client" file restrictions
- Test deep import detection
- Test *.server.* file blocking for client
- Test UI-safe lib allowlist
- Test circular dependency detection

---

### Phase 3: Implement Additional Rules

#### Rule 3.1: Deep Import Ban
**Goal:** Block deep imports into protected directories

**Protected paths:**
- `collections/**` - Must import from collection index or types
- `endpoints/**` - Must import through API layer
- `features/**/internal/**` - Internal implementation hidden

**Example violations:**
```javascript
// ❌ Deep import into collection
import { roleConfig } from '@/collections/Users/access/roleConfig'

// ✅ Correct - import from public interface
import { UserRole } from '@/types/roles'
```

#### Rule 3.2: Circular Dependency Detection
**Goal:** Detect and prevent circular imports between zones

**Approach:**
- Build import graph during linting
- Detect cycles using DFS traversal
- Report full cycle path for debugging

**Example:**
```
❌ Circular dependency detected:
   lib/user-service.ts → collections/Users → lib/user-service.ts
```

#### Rule 3.3: File Size Warning
**Goal:** Warn on files >200 lines (soft limit)

**Scope:**
- `src/components/**`
- `src/app/(frontend)/**`

**Exclusions:**
- Schemas, contracts, config files
- `index.ts` barrel files
- Files with `// eslint-disable-next-line max-lines` comment

---

### Phase 4: Refactor Existing Violations

#### Task 4.1: Move Role Constants
**Current violation:** 4 components importing from `collections/Users/roles`

**Steps:**
1. Create `src/types/roles.ts`:
```typescript
// src/types/roles.ts
export enum UserRole {
  SUPER_ADMIN = 'super-admin',
  ADMIN = 'admin',
  USER = 'user',
}

export const USER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.USER,
] as const
```

2. Update `collections/Users/roles.ts` to re-export from types:
```typescript
// src/collections/Users/roles.ts
export { UserRole, USER_ROLES } from '@/types/roles'
// Keep collection-specific role logic here
```

3. Update component imports (4 files):
```typescript
// Before
import { UserRole } from '@/collections/Users/roles'

// After
import { UserRole } from '@/types/roles'
```

**Files to update:**
- Search codebase for `from '@/collections/Users/roles'`
- Update all UI layer imports
- Keep SERVER layer imports as-is (can still import from collections)

#### Task 4.2: Validate lib/queries Structure
**Action:** Confirm lib/queries is properly marked server-only

**Checks:**
- No "use client" files import from lib/queries
- All lib/queries files are in server-only sub-zone
- Add JSDoc comments: `/** @module server-only */`

---

### Phase 5: Integration & Configuration

#### Task 5.1: Update ESLint Config
**File:** `eslint.config.mjs`

**Changes:**
```javascript
import aguPlugin from './eslint-plugin-aguy/index.js'

export default [
  // ... existing config
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'aguy': aguPlugin,
    },
    rules: {
      // SECURITY & PATTERN RULES (already implemented)
      'aguy/require-collection-access': 'error',
      'aguy/no-nested-metadata': 'error',
      'aguy/tailwind-only-components': 'warn',
      'aguy/require-auth-endpoints': 'error',

      // NEW BOUNDARY RULES
      'aguy/enforce-boundaries': 'error',
      'aguy/no-deep-imports': 'error',
      'aguy/no-circular-deps': 'error',
    },
    settings: {
      aguy: {
        zones: {
          // Full zone configuration
          APP: { ... },
          UI: { ... },
          // etc.
        },
        uiSafeLib: [
          'lib/errors.ts',
          'lib/feature-flags.ts',
        ],
      },
    },
  },
]
```

#### Task 5.2: Update Lint-Staged
**File:** `.lintstagedrc.json`

**No changes required** - already runs `eslint --fix` on staged TS files

#### Task 5.3: Update Husky Hooks
**Files:** `.husky/pre-commit`, `.husky/pre-push`

**Changes:**
- pre-commit: Already runs lint-staged (covers boundary rules)
- pre-push: Already runs full lint (catches all violations)
- **No changes needed** - existing hooks sufficient

#### Task 5.4: Update CI Pipeline
**File:** `.github/workflows/ci.yml`

**Changes:**
- Quality job already runs `pnpm lint`
- Add explicit boundary check step for visibility:

```yaml
- name: Check Architectural Boundaries
  run: pnpm lint --rule 'aguy/enforce-boundaries: error'
```

---

### Phase 6: Documentation & Rollout

#### Task 6.1: Update Documentation

**Files to create/update:**

1. **docs/architecture/ZONE-BOUNDARIES.md** (NEW)
   - Visual zone diagram
   - Import rules reference
   - Common patterns and examples
   - Troubleshooting guide

2. **docs/plans/code-quality-boundaries/VIOLATIONS-GUIDE.md** (NEW)
   - Common violation patterns
   - How to fix each type
   - When to request exceptions

3. **AGENTS.md** (UPDATE)
   - Add zone boundary section
   - Reference new rules

4. **eslint-plugin-aguy/README.md** (UPDATE)
   - Document enforce-boundaries rule
   - Configuration options
   - Examples

#### Task 6.2: Team Communication

**Rollout strategy:**
- NO grace period (per spec)
- All violations must be fixed before merge

**Communication points:**
1. Announce in team chat/standup
2. Share docs/architecture/ZONE-BOUNDARIES.md
3. Explain rationale and benefits
4. Offer to pair on fixes

#### Task 6.3: Exception Process

**For legitimate exceptions:**

1. Add inline ESLint disable comment:
```typescript
// eslint-disable-next-line aguy/enforce-boundaries -- [TICKET-123] Reason for exception
import { ServerOnlyUtil } from '@/lib/server-only-util'
```

2. Document in code review why exception is needed
3. Create follow-up ticket to refactor if possible

**Exception criteria:**
- Temporary during migration
- Technical limitation (rare)
- Explicitly approved by tech lead

---

## Testing Strategy

### Unit Tests (ESLint Rules)
**Location:** `eslint-plugin-aguy/tests/`

**Test coverage required:**

1. **enforce-boundaries.test.js:**
   - ✅ Each zone can import allowed zones
   - ❌ Each zone cannot import forbidden zones
   - ❌ UI cannot import server-only lib paths
   - ✅ UI can import UI-safe lib allowlist
   - ❌ "use client" files cannot import server modules
   - ✅ "use server" files can import server modules
   - ❌ Deep imports into protected directories
   - Valid import detection (no false positives)

2. **no-deep-imports.test.js:**
   - ❌ Deep imports into collections/
   - ❌ Deep imports into endpoints/
   - ✅ Imports from public interfaces

3. **no-circular-deps.test.js:**
   - ❌ Direct circular dependency (A → B → A)
   - ❌ Indirect circular dependency (A → B → C → A)
   - ✅ No false positives on valid imports

### Integration Tests
**Location:** `tests/int/`

**New test file:** `tests/int/eslint-boundaries.int.spec.ts`

**Test cases:**
```typescript
describe('Zone Boundary Enforcement', () => {
  it('should fail lint on UI importing SERVER', async () => {
    // Create temp file with violation
    // Run ESLint programmatically
    // Assert error thrown
  })

  it('should pass lint on valid zone imports', async () => {
    // Create temp file with valid imports
    // Run ESLint
    // Assert no errors
  })

  it('should fail on client component importing lib/queries', async () => {
    // Test "use client" + server import
  })
})
```

### Manual Testing Checklist

**Before merge:**
- [ ] Run `pnpm lint` - passes with no boundary violations
- [ ] Run `pnpm typecheck` - no TS errors
- [ ] Run `pnpm build` - successful build
- [ ] Run `pnpm test` - all tests pass
- [ ] Create intentional violation - verify lint fails
- [ ] Test pre-commit hook - blocks bad import
- [ ] Test pre-push hook - blocks bad import
- [ ] Test CI pipeline - fails on violation

---

## File Changes Summary

### New Files (7)
1. `eslint-plugin-aguy/lib/rules/enforce-boundaries.js`
2. `eslint-plugin-aguy/lib/rules/no-deep-imports.js`
3. `eslint-plugin-aguy/lib/rules/no-circular-deps.js`
4. `eslint-plugin-aguy/tests/enforce-boundaries.test.js`
5. `eslint-plugin-aguy/tests/no-deep-imports.test.js`
6. `eslint-plugin-aguy/tests/no-circular-deps.test.js`
7. `src/types/roles.ts`

### Modified Files (15+)
1. `eslint-plugin-aguy/package.json` - Add "type": "module"
2. `eslint-plugin-aguy/index.js` - Convert to ESM
3. `eslint-plugin-aguy/lib/rules/*.js` (4 files) - Convert to ESM
4. `eslint-plugin-aguy/tests/*.js` (4 files) - Convert to ESM
5. `eslint.config.mjs` - Add plugin and rules
6. `.github/workflows/ci.yml` - Add boundary check step
7. `collections/Users/roles.ts` - Re-export from types
8. `src/components/**/*.tsx` (4 files) - Update role imports
9. `docs/architecture/ZONE-BOUNDARIES.md` - NEW documentation
10. `docs/plans/code-quality-boundaries/VIOLATIONS-GUIDE.md` - NEW guide
11. `AGENTS.md` - Add boundary documentation
12. `eslint-plugin-aguy/README.md` - Document new rules

---

## Critical Files to Review

These files contain the core zone boundary logic:

1. **[eslint-plugin-aguy/lib/rules/enforce-boundaries.js](eslint-plugin-aguy/lib/rules/enforce-boundaries.js)** - Main boundary enforcement rule
2. **[eslint.config.mjs](eslint.config.mjs)** - Zone configuration and rule setup
3. **[src/types/roles.ts](src/types/roles.ts)** - Shared role constants (NEW)
4. **[docs/architecture/ZONE-BOUNDARIES.md](docs/architecture/ZONE-BOUNDARIES.md)** - Architectural documentation (NEW)

---

## Risk Assessment

### High Risk
- **ESLint plugin conversion:** Breaking existing rules during ESM conversion
  - *Mitigation:* Comprehensive unit tests, staged rollout of converted rules

- **Blocking legitimate patterns:** Over-restrictive rules break valid code
  - *Mitigation:* UI-safe lib allowlist, exception process, thorough testing

### Medium Risk
- **Developer friction:** New rules slow down development
  - *Mitigation:* Clear documentation, helpful error messages, pair programming support

- **False positives:** Rules flag valid imports
  - *Mitigation:* Extensive test coverage, real-world validation before enforcement

### Low Risk
- **Performance impact:** Linting takes longer
  - *Mitigation:* Zone detection caching, efficient AST traversal

- **CI build time:** Additional lint steps
  - *Mitigation:* Parallel job execution (already in place)

---

## Success Metrics

**Immediate (Week 1):**
- ✅ All existing violations fixed
- ✅ ESLint plugin successfully converted to ESM
- ✅ Zero boundary violations in CI

**Short-term (Month 1):**
- ✅ No new boundary violations introduced
- ✅ Zero client bundles with server code
- ✅ Developers understand zone rules

**Long-term (Quarter 1):**
- ✅ Reduced refactoring time (clearer boundaries)
- ✅ Fewer bugs from accidental dependencies
- ✅ New features follow zone patterns

---

## Implementation Order

**Recommended sequence:**

### Week 1: Plugin Foundation
1. ✅ Convert eslint-plugin-aguy to ESM
2. ✅ Test existing 4 rules with ESM
3. ✅ Integrate plugin in eslint.config.mjs

### Week 2: Boundary Rules
4. ✅ Implement enforce-boundaries rule
5. ✅ Write comprehensive unit tests
6. ✅ Test with current codebase (warnings only)

### Week 3: Additional Rules & Refactoring
7. ✅ Implement no-deep-imports rule
8. ✅ Implement no-circular-deps rule
9. ✅ Move role constants to types/
10. ✅ Fix component imports

### Week 4: Integration & Rollout
11. ✅ Enable all rules as errors
12. ✅ Update CI pipeline
13. ✅ Write documentation
14. ✅ Team announcement and training

---

## Verification Checklist

**Before marking complete:**

- [ ] All ESLint rules pass with zero violations
- [ ] `pnpm lint` exits 0
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm build` successful
- [ ] `pnpm test` all pass
- [ ] Pre-commit hook blocks violations
- [ ] Pre-push hook blocks violations
- [ ] CI pipeline fails on violations
- [ ] Documentation complete
- [ ] Team trained on new rules
- [ ] Exception process documented
- [ ] Success metrics baseline captured

---

## Next Steps

After this plan is approved:

1. Create implementation branch: `feat/code-quality-boundaries`
2. Set up task tracking (GitHub issues or project board)
3. Begin Phase 1: ESLint Plugin Conversion
4. Daily standups to report progress
5. Request code review after each phase
6. Merge to dev after all checks pass

---

## Questions for Reviewer

1. **Zone mapping:** Any directories that should be in different zones?
2. **UI-safe lib allowlist:** Are there other lib files that UI needs?
3. **Exception process:** Should we require PR approval for exceptions?
4. **Rollout timing:** Any features in flight that need coordination?
5. **Performance:** Should we benchmark lint time before/after?

---

## Appendix: Zone Import Matrix

| From ↓ / To → | APP | UI | SERVER | DOMAIN | LIB | SERVICES | UTILS | I18N |
|---------------|-----|----|---------|---------|----|----------|-------|------|
| **APP**       | ✅  | ✅ | ❌      | ✅      | ✅ | ✅       | ✅    | ✅   |
| **UI**        | ❌  | ✅ | ❌      | ✅      | 🔶 | ❌       | ✅    | ✅   |
| **SERVER**    | ❌  | ❌ | ✅      | ✅      | 🔶 | ✅       | ✅    | ✅   |
| **DOMAIN**    | ❌  | ❌ | ❌      | ✅      | ❌ | ❌       | ❌    | ❌   |
| **LIB**       | ❌  | ❌ | ❌      | ✅      | ✅ | ❌       | ✅    | ✅   |
| **SERVICES**  | ❌  | ❌ | ❌      | ✅      | 🔶 | ✅       | ✅    | ❌   |
| **UTILS**     | ❌  | ❌ | ❌      | ✅      | ❌ | ❌       | ✅    | ✅   |
| **I18N**      | ❌  | ❌ | ❌      | ❌      | ❌ | ❌       | ❌    | ✅   |

**Legend:**
- ✅ Allowed
- ❌ Forbidden
- 🔶 Restricted (server-only LIB or UI-safe LIB allowlist)

---

**Plan Status:** Ready for approval and implementation
**Last Updated:** 2026-01-09
