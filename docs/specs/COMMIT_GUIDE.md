# Commit Guide – Passing Pre-Commit Hooks

> Quick reference for successful commits. All commits must pass automated checks.

---

## Goal

Make commits that pass all pre-commit hooks in <15 seconds.

## Core Principles

- ✓ Protected branches → PR workflow required
- ✓ Branch naming → `<type>/<kebab-case>` pattern
- ✓ Secrets detection → Blocked immediately
- ✓ CSS files → Blocked (Tailwind-only, except `globals.css`)
- ✓ Linting → Auto-fixed by lint-staged
- ✓ Type checking → Fast incremental check
- ✓ Commit format → Conventional commits enforced

---

## Branch Setup

### Protected Branches

| Branch | Status | Action |
|--------|--------|--------|
| `main`, `dev` | ❌ Blocked | Create feature branch first |

**Error:** `Direct commits to 'main' branch are not allowed`

### Branch Naming

```
Pattern: <type>/<description-in-kebab-case>
Regex:   ^(feat|fix|chore|docs|refactor|test|security)/[a-z0-9-]+$
```

| Type | Use Case | Example |
|------|----------|---------|
| `feat/` | New features | `feat/user-authentication` |
| `fix/` | Bug fixes | `fix/login-bug` |
| `chore/` | Maintenance | `chore/update-deps` |
| `docs/` | Documentation | `docs/api-docs` |
| `refactor/` | Code restructuring | `refactor/auth-service` |
| `test/` | Tests | `test/integration` |
| `security/` | Security fixes | `fix/xss-vuln` |

**Rename:** `git branch -m feat/new-name`

---

## Pre-Commit Checks (in sequence)

| # | Check | Action on Fail | Time |
|---|-------|----------------|------|
| 1 | Branch protection | Block commit | <1s |
| 2 | Branch naming | Block commit | <1s |
| 3 | Secret detection | ⚠️ Warning | <1s |
| 4 | CSS/SCSS block | Block commit | <1s |
| 5 | Lint-staged | Auto-fix | <5s |
| 6 | Type check | Block commit | <5s |

### Secrets Detected

**Patterns blocked:** `.env` files, `AIzaSy...` (Google), `sk-...` (OpenAI), `ghp_...` (GitHub), MongoDB URIs, `AKIA...` (AWS), `sk_live_...` (Stripe), `xox...` (Slack)

**Fix:** `git reset HEAD file` → move secret to `.env` → update code to use `process.env.API_KEY`

### CSS Blocking

**Exception:** `src/app/(frontend)/globals.css` allowed for design system variables.

**Fix:** Remove CSS file, use Tailwind classes.

### Lint-Staged

| File Type | Tools |
|-----------|-------|
| JS/TS | `eslint --fix --max-warnings=0` → `prettier --write` |
| JSON/MD/YAML | `prettier --write` |
| Docs | Auto-generate indexes, validate links |

### Type Checking

**After changing Payload schemas:** Run `pnpm generate:types`

### Common Fixes

```typescript
// ❌ Unused variable → fail
function fn(userId, name) { console.log(userId) }

// ✅ Prefix with underscore
function fn(userId, _name) { console.log(userId) }
```

**Run manually:** `pnpm lint:fix` → `pnpm typecheck`

---

## Commit Message Format

```
<type>: <subject>

<body> (min 20 chars)
```

### Rules

| Rule | Requirement |
|------|-------------|
| Type | One of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, security |
| Subject | Sentence case, max 100 chars, no period |
| Body | Required, min 20 chars, explain "why" |

### Valid Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting only |
| `refactor` | No feature/fix |
| `perf` | Performance |
| `test` | Test changes |
| `build` | Build system |
| `ci` | CI/CD config |
| `chore` | No src/test change |
| `revert` | Revert commit |
| `security` | Security fix |

### Examples

**✅ Good:**
```
feat: Add user authentication

Implemented JWT-based authentication with login, logout, and token refresh.
```

**❌ Bad:**
```
feat: add feature                           // wrong case
feat: Add feature.                         // period at end
feat: Add feature                          // missing body
feature: Add feature                       // wrong type
```

**Real examples from project:**
```
feat(chat): Implement context-scoped conversations
feat: Add diff-scoped auto-fix workflow
fix: Replace hardcoded colors with design system tokens
refactor: Remove overly-specific CSS variables from globals.css
```

---

## Error Recovery

| Error | Fix |
|-------|-----|
| `Direct commits to 'main'` | `git checkout -b feat/your-feature` |
| `Invalid branch name` | `git branch -m feat/descriptive-name` |
| `API key detected` | `git reset HEAD file && move secret to .env` |
| `CSS/SCSS not allowed` | Remove CSS file, use Tailwind classes |
| `Lint failed` | `pnpm lint:fix` then re-commit |
| `Type check failed` | `pnpm typecheck` → fix errors → re-commit |
| `Commit message invalid` | Add body (20+ chars), correct format |

---

## Skip Mechanisms

**Use sparingly (<1% of commits):**

```bash
# Option 1
SKIP_HOOKS=1 git commit -m "fix: Emergency fix"

# Option 2
git commit --no-verify -m "fix: Emergency fix"
```

**Warning:** May fail in CI. Fix in follow-up commit.

---

## Complete Example

```bash
# 1. Create branch
git checkout -b feat/user-authentication

# 2. Make changes
# Edit: src/components/Login.tsx

# 3. Stage
git add src/components/Login.tsx

# 4. Commit (opens editor)
git commit
# Write:
# feat: Add user authentication
#
# Implemented login form with email/password validation,
# form state management, and error handling.

# 5. Hooks run → ✅ Pass
# 6. Push
git push -u origin feat/user-authentication
```

---

## Additional Hooks

### pre-push Hook

Runs integration tests before push. **Skip:** `git push --no-verify`

### post-merge Hook

Auto-runs `pnpm install` if lockfile changed, `pnpm generate:types` if schema changed.

---

## Quick Card

```
COMMIT QUICK CARD

✓ Branch: feat/fix/chore/docs/refactor/test/security + kebab-case
✓ Message: <type>: <subject>\n\n<body> (20+ chars)
✓ No CSS files (Tailwind only, except globals.css)
✓ No secrets in staged files
✓ After schema change: pnpm generate:types

COMMANDS:
  git checkout -b feat/name
  pnpm lint:fix && pnpm typecheck  # Manual check
  SKIP_HOOKS=1 git commit          # Emergency only

FILES:
  Hooks: .husky/pre-commit
  Lint: eslint.config.mjs
  Commit: commitlint.config.js
  Schema: src/collections/
```

---

**References:** [AGENTS.md](../../AGENTS.md) • [CLAUDE.md](../../CLAUDE.md) • [.husky/pre-commit](../../.husky/pre-commit) • [commitlint.config.js](../../commitlint.config.js)

**Last Updated:** 2026-01-12
