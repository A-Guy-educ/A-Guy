# Commit Guide: Passing Pre-Commit Hooks

Complete guide to making successful commits in this project. All commits must pass automated checks before being accepted.

## Table of Contents

- [Quick Start](#quick-start)
- [Branch Setup](#branch-setup)
- [Pre-Commit Checks](#pre-commit-checks)
- [Commit Message Format](#commit-message-format)
- [Troubleshooting](#troubleshooting)
- [Skip Mechanisms](#skip-mechanisms)
- [Complete Workflow Examples](#complete-workflow-examples)
- [Additional Hooks](#additional-hooks)

---

## Quick Start

**TL;DR - Three steps to a successful commit:**

1. ✅ Create a properly named branch: `git checkout -b feat/your-feature`
2. ✅ Make your changes and stage them: `git add <files>`
3. ✅ Write a conventional commit message with body (min 20 chars)

**Pre-commit hooks automatically:**
- Auto-fix formatting and linting (< 5 seconds)
- Type-check your changes (< 5 seconds)
- **Build & tests run in CI** (not locally)

**Most common commands:**

```bash
# Create a feature branch
git checkout -b feat/user-authentication

# Stage your changes
git add src/components/LoginForm.tsx

# Commit with proper format (opens editor for body)
git commit

# In editor, write:
# feat: Add user authentication form
#
# Implemented login form component with email/password validation,
# form state management, and error handling for authentication failures.
```

**Visual Workflow:**

```
main/dev → Create branch → Make changes → Stage files → Commit
    ↓          ↓              ↓              ↓           ↓
Protected  feat/name    Edit code    git add     Pre-commit checks
                                                        ↓
                                                   All pass? ✅
                                                        ↓
                                                  Commit success!
```

---

## Branch Setup

### Protected Branches

Direct commits to `main` and `dev` branches are **blocked**. All changes must go through pull requests.

**If you try to commit to main/dev:**

```
❌ ERROR: Direct commits to 'main' branch are not allowed
All changes must go through pull requests.
```

**Solution:** Create a feature branch first.

### Branch Naming Convention

Branch names must follow this pattern:

```
<type>/<description-in-kebab-case>
```

**Valid branch types:**

- `feat/` - New features
- `fix/` - Bug fixes
- `chore/` - Maintenance tasks
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `security/` - Security fixes

**Regex pattern:** `^(feat|fix|chore|docs|refactor|test|security)/[a-z0-9-]+$`

**✅ Good branch names:**

```bash
git checkout -b feat/user-authentication
git checkout -b fix/login-bug
git checkout -b chore/update-dependencies
git checkout -b docs/api-documentation
git checkout -b refactor/auth-service
git checkout -b test/integration-tests
git checkout -b security/sql-injection-fix
```

**❌ Bad branch names:**

```bash
git checkout -b feature/UserAuth          # Wrong: not 'feature', use 'feat'
git checkout -b feat/User_Authentication  # Wrong: underscores not allowed
git checkout -b fix/LoginBug              # Wrong: not kebab-case
git checkout -b my-branch                 # Wrong: missing type prefix
git checkout -b feat/                     # Wrong: missing description
```

**How to rename your branch:**

```bash
# If you're on the incorrectly named branch
git branch -m feat/correct-name

# Or specify the branch name
git branch -m old-branch-name feat/new-name
```

---

## Pre-Commit Checks

When you run `git commit`, the following checks run automatically in sequence:

### 1. Branch Protection Check

**What it does:** Prevents direct commits to `main` and `dev` branches.

**Why:** Enforces PR workflow for code review and CI/CD.

**Error message:**

```
❌ ERROR: Direct commits to 'main' branch are not allowed
```

**Fix:** Create a feature branch:

```bash
git checkout -b feat/your-feature-name
```

---

### 2. Branch Naming Validation

**What it does:** Validates branch name matches the required pattern.

**Why:** Maintains consistency and enables automated workflows.

**Error message:**

```
❌ ERROR: Invalid branch name: 'my-branch'
Branch names must follow one of these patterns:
  ✅ feat/<description>     - New features
  ✅ fix/<description>      - Bug fixes
  ...
```

**Fix:** Rename your branch:

```bash
git branch -m feat/descriptive-name
```

---

### 3. Secret Detection

**What it does:** Scans staged files for API keys, credentials, and sensitive data.

**Why:** Prevents accidental exposure of secrets in version control.

**Patterns detected:**

- `.env` file staging
- Google API keys: `AIzaSy...`
- OpenAI API keys: `sk-...`
- GitHub tokens: `ghp_...`, `gho_...`
- MongoDB connection strings
- AWS Access Keys: `AKIA...`
- Stripe keys: `sk_live_...`, `pk_live_...`
- Slack tokens: `xox...`

**Error message:**

```
⚠️  WARNING: Potential OpenAI API key detected in staged code!
Please make sure you're not committing sensitive keys.
```

**Fix:**

```bash
# Unstage the file with secrets
git reset HEAD src/config/api.ts

# Move secrets to .env file
echo "OPENAI_API_KEY=sk-..." >> .env

# Update code to use environment variables
# const apiKey = process.env.OPENAI_API_KEY

# Stage the fixed file
git add src/config/api.ts
```

---

### 4. CSS Blocking

**What it does:** Blocks commits of `.css`, `.scss`, `.sass` files (except `globals.css`).

**Why:** Project uses Tailwind CSS exclusively for styling consistency.

**Error message:**

```
❌ ERROR: CSS/SCSS files are not allowed in this project
This project uses Tailwind CSS exclusively.

Blocked files:
  - src/components/Button.css
```

**Fix:**

```bash
# Remove the CSS file
rm src/components/Button.css

# Use Tailwind utility classes instead
# <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
```

**Exception:** `src/app/(frontend)/globals.css` is allowed for design system variables.

**Reference:** See [AGENTS.md](../../AGENTS.md) for styling guidelines.

---

### 5. Lint-Staged (Auto-fix & Format)

**What it does:** Runs ESLint and Prettier on staged files, auto-fixing issues.

**Why:** Maintains code quality and consistent formatting.

**What runs:**

- **JavaScript/TypeScript files:** `eslint --fix --max-warnings=0` → `prettier --write`
- **JSON/Markdown/YAML:** `prettier --write`
- **Documentation files:** Auto-generates indexes and validates links

**Common issues:**

**Unused variables:**

```typescript
// ❌ Will fail
function example(userId, name) {
  console.log(userId)
}

// ✅ Fix: prefix unused vars with underscore
function example(userId, _name) {
  console.log(userId)
}
```

**Missing semicolons, formatting issues:** Usually auto-fixed by prettier.

**Import order issues:** Usually auto-fixed by ESLint.

**⏱️ Speed:** Typically < 5 seconds

---

### 6. Type Checking

**What it does:** Fast type checking on staged TypeScript files only.

**Why:** Catches type errors before runtime without slowing down commits.

**Error message:**

```
src/components/LoginForm.tsx:42:15 - error TS2339:
Property 'username' does not exist on type 'User'.
```

**Fix:**

```bash
# Run type checking manually to see all errors
pnpm typecheck

# or
pnpm exec tsc --noEmit

# Fix the type errors in your code
# Then stage the fixed files
git add src/components/LoginForm.tsx
```

**Common fixes:**

```typescript
// ❌ Wrong
const user: User = { name: 'John', username: 'john123' }

// ✅ Correct - check User type definition
const user: User = { name: 'John', email: 'john@example.com' }
```

**Tip:** After changing collection schemas, run `pnpm generate:types` to update Payload types.

**⏱️ Speed:** Typically < 5 seconds (incremental check)

---

### Build & Test Verification (Runs in CI)

**What happens:** Build verification and full test suite run in CI, not on commit.

**Why:** Keeps commits fast while still ensuring quality through CI.

**When they run:**
- ✅ On every push to your branch
- ✅ On every pull request
- ✅ Before merging to main/dev

**To run locally before pushing:**

```bash
# Run all quality checks + tests
pnpm ci:local

# Or run individually
pnpm build        # Build check
pnpm test:unit    # Unit tests
pnpm test:int     # Integration tests
pnpm test:e2e     # E2E tests
```

**Benefits:**
- ⚡ Fast commits (< 15 seconds vs 2-5 minutes)
- ✅ Still catch issues before merge
- 🔄 CI provides comprehensive validation
- 💡 Less temptation to skip hooks

---

## Commit Message Format

This project uses **Conventional Commits** with strict validation.

### Required Format

```
<type>: <subject>

<body>
```

**Rules:**

1. **Type:** Must be one of the valid types (see below)
2. **Subject:** Sentence case, max 100 characters, no period at end
3. **Body:** Required, minimum 20 characters, describes the "why" not the "what"

### Valid Commit Types

| Type       | Use Case                                         | Example                              |
| ---------- | ------------------------------------------------ | ------------------------------------ |
| `feat`     | New feature                                      | `feat: Add user authentication`      |
| `fix`      | Bug fix                                          | `fix: Resolve login redirect issue`  |
| `docs`     | Documentation only                               | `docs: Update API documentation`     |
| `style`    | Formatting, whitespace (no code change)          | `style: Fix indentation in Auth.tsx` |
| `refactor` | Code change (no bug fix or feature)              | `refactor: Extract auth logic`       |
| `perf`     | Performance improvement                          | `perf: Optimize database queries`    |
| `test`     | Adding/correcting tests                          | `test: Add auth service tests`       |
| `build`    | Build system or dependency changes               | `build: Update Next.js to v15`       |
| `ci`       | CI/CD configuration changes                      | `ci: Add deployment workflow`        |
| `chore`    | Other changes (no src/test modification)         | `chore: Update dependencies`         |
| `revert`   | Revert previous commit                           | `revert: Revert "Add feature X"`     |
| `security` | Security-related changes                         | `security: Fix XSS vulnerability`    |

### Good Commit Message Examples

**✅ Example 1: Feature**

```
feat: Add user authentication system

Implemented JWT-based authentication with login, logout, and token refresh
functionality. Added middleware for protected routes and session management.
```

**✅ Example 2: Bug Fix**

```
fix: Resolve infinite loop in chat message rendering

Fixed issue where chat messages would continuously re-render due to improper
dependency array in useEffect. Added message ID comparison to prevent duplicates.
```

**✅ Example 3: Refactoring**

```
refactor: Extract conversation service logic into separate module

Moved conversation-related database operations from endpoint handlers into
a dedicated service layer for better testability and code organization.
```

**Real examples from project history:**

```bash
feat(chat): Implement context-scoped conversations
feat: Add diff-scoped auto-fix workflow
fix: Replace hardcoded colors with design system tokens
refactor: Remove overly-specific CSS variables from globals.css
chore: Update local settings and add ESLint inline styles plan
```

### Bad Commit Message Examples

**❌ Example 1: No body**

```
feat: Add authentication
```

Error: Body must not be empty (minimum 20 characters required)

**❌ Example 2: Wrong case**

```
feat: add authentication system

Added JWT authentication with middleware.
```

Error: Subject must be in sentence case (capitalize first letter)

**❌ Example 3: Period at end**

```
feat: Add authentication system.

Added JWT authentication with middleware.
```

Error: Subject must not end with a period

**❌ Example 4: Invalid type**

```
feature: Add authentication

Implemented JWT-based authentication system.
```

Error: Type must be one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, security

### Writing Commit Messages

**Option 1: Use editor (recommended for detailed messages)**

```bash
git commit
# Opens editor with template
```

**Option 2: Inline with heredoc**

```bash
git commit -m "$(cat <<'EOF'
feat: Add user authentication

Implemented JWT-based authentication with login and logout functionality.
Added middleware for protected routes and session management.
EOF
)"
```

**Tips:**

- Focus on "why" not "what" (the diff shows "what")
- Be specific but concise
- Reference issue numbers if applicable: `Fixes #123`
- Use imperative mood: "Add feature" not "Added feature"

---

## Troubleshooting

### Error: "Direct commits to 'main' branch are not allowed"

**Cause:** Attempting to commit directly to protected branch.

**Fix:**

```bash
# Create a new branch from your current state
git checkout -b feat/your-feature

# Now commit on this branch
git commit
```

---

### Error: "Invalid branch name"

**Cause:** Branch name doesn't follow `<type>/<description>` pattern.

**Fix:**

```bash
# Rename your branch
git branch -m feat/descriptive-kebab-case-name

# Try commit again
git commit
```

---

### Error: "Potential [API Key Type] detected"

**Cause:** Sensitive data found in staged files.

**Fix:**

```bash
# Unstage the file
git reset HEAD path/to/file

# Move secret to .env
echo "API_KEY=your-key" >> .env

# Update code to use environment variable
# const apiKey = process.env.API_KEY

# Stage the corrected file
git add path/to/file
```

---

### Error: "CSS/SCSS files are not allowed"

**Cause:** Attempting to commit CSS files (Tailwind-only project).

**Fix:**

```bash
# Remove the CSS file
git reset HEAD path/to/file.css
rm path/to/file.css

# Use Tailwind classes instead
# Replace: <div class="custom-button">
# With: <div className="bg-blue-500 px-4 py-2 rounded">

# Commit your changes
git add path/to/component
```

---

### Error: Linting failed

**Cause:** ESLint found issues that couldn't be auto-fixed.

**Fix:**

```bash
# Run lint to see issues
pnpm lint

# Or fix automatically
pnpm lint:fix

# Common fixes:
# - Remove unused imports
# - Prefix unused variables with underscore
# - Fix TypeScript types

# Stage fixed files
git add .
git commit
```

---

### Error: Type checking failed

**Cause:** TypeScript type errors in your code.

**Fix:**

```bash
# See all type errors
pnpm typecheck

# Fix type errors in your code
# After fixing collection schemas, regenerate types:
pnpm generate:types

# Stage fixes and commit
git add .
git commit
```

---

### Want to run build/tests locally?

**Optional:** Build and tests now run in CI, but you can still run them locally:

```bash
# Run all quality checks + tests (mimics CI)
pnpm ci:local

# Or run individually
pnpm build        # Verify build succeeds
pnpm test:unit    # Run unit tests
pnpm test:int     # Run integration tests (needs DB)
pnpm test:e2e     # Run E2E tests

# Quick quality check (no tests)
pnpm ci:quality   # typecheck + lint + format:check
```

**When to use:**
- Before pushing to avoid CI failures
- When making large refactoring changes
- When you want extra confidence

---

### Error: Commit message validation failed

**Cause:** Commit message doesn't follow conventional commits format.

**Common issues:**

```bash
# ❌ Missing body
git commit -m "feat: Add feature"
# Fix: Add body with at least 20 characters

# ❌ Wrong case
git commit -m "feat: add feature"
# Fix: Use sentence case "feat: Add feature"

# ❌ Period at end
git commit -m "feat: Add feature."
# Fix: Remove period

# ❌ Invalid type
git commit -m "feature: Add feature"
# Fix: Use "feat" not "feature"
```

**Fix:** Use proper format:

```bash
git commit -m "feat: Add feature

This is the commit body with at least 20 characters explaining the change."
```

---

### "I accidentally committed to main/dev"

**Before pushing:**

```bash
# Create a branch with your commits
git checkout -b feat/my-feature

# Reset main/dev to origin
git checkout main
git reset --hard origin/main
```

**After pushing (requires force push - be careful!):**

```bash
# Contact your team lead first!
# This rewrites history and can cause issues for others
```

---

### "My commit keeps failing and I need to commit NOW"

**Skip hooks (use sparingly!):**

```bash
# Option 1: Skip all hooks
SKIP_HOOKS=1 git commit -m "feat: Emergency fix

Quick fix for production issue, will clean up in follow-up PR."

# Option 2: Skip verification
git commit --no-verify -m "feat: Emergency fix

Quick fix for production issue, will clean up in follow-up PR."
```

**⚠️ Warning:** Skipped commits may fail in CI/CD. Fix issues in a follow-up commit.

---

## Skip Mechanisms

### When to Skip Hooks

**Valid reasons:**

- Emergency production hotfix (must be cleaned up later)
- WIP commits on personal feature branch (clean up before PR)
- Reverting a breaking commit quickly
- Working offline and CI will catch issues later

**Invalid reasons:**

- "Tests take too long" - Fix slow tests instead
- "I'll fix it later" - Fix it now
- "It's not important" - All commits should pass checks

### How to Skip

**Method 1: Environment variable**

```bash
SKIP_HOOKS=1 git commit -m "feat: Quick fix

Emergency fix for production issue."
```

**Method 2: Git flag**

```bash
git commit --no-verify -m "feat: Quick fix

Emergency fix for production issue."
```

### Consequences of Skipping

- ❌ Your commit may fail in CI/CD pipeline
- ❌ Potentially broken code in version history
- ❌ May block team members
- ⚠️ You're responsible for fixing issues in follow-up commit

### Team Expectations

- Skip hooks rarely (< 1% of commits)
- Always note in commit message: "Skipped hooks for [reason]"
- Fix issues immediately in follow-up commit
- Don't skip on shared branches (main, dev)

---

## Complete Workflow Examples

### Example 1: Simple Feature Addition

**Scenario:** Add a new button component

```bash
# 1. Create feature branch
git checkout -b feat/add-primary-button

# 2. Create the component
# Edit: src/components/ui/Button.tsx

# 3. Stage changes
git add src/components/ui/Button.tsx

# 4. Commit with proper message
git commit
# In editor:
# feat: Add primary button component
#
# Created reusable button component with primary, secondary, and danger
# variants. Includes hover states and loading spinner integration.

# 5. Hooks run automatically:
#    ✅ Branch naming valid
#    ✅ No secrets detected
#    ✅ No CSS files
#    ✅ Linting passed (auto-fixed)
#    ✅ Type checking passed
#    ✅ Build succeeded
#    ✅ Tests passed

# 6. Push and create PR
git push -u origin feat/add-primary-button
```

---

### Example 2: Bug Fix with Multiple Files

**Scenario:** Fix authentication bug affecting multiple files

```bash
# 1. Create fix branch
git checkout -b fix/auth-token-expiry

# 2. Make changes
# Edit: src/lib/auth.ts
# Edit: src/middleware/auth.ts
# Edit: tests/unit/auth.test.ts

# 3. Ensure tests pass locally
pnpm test:unit

# 4. Stage all changes
git add src/lib/auth.ts src/middleware/auth.ts tests/unit/auth.test.ts

# 5. Commit
git commit -m "$(cat <<'EOF'
fix: Resolve authentication token expiry issue

Fixed bug where expired tokens were not being refreshed properly, causing
users to be logged out unexpectedly. Updated token validation logic and
added comprehensive tests for edge cases.
EOF
)"

# 6. All checks pass, push
git push -u origin fix/auth-token-expiry
```

---

### Example 3: Recovering from Failed Commit

**Scenario:** Commit fails due to type errors

```bash
# 1. Try to commit
git commit
# ❌ Type checking failed!

# 2. See what failed
pnpm typecheck
# Error: Property 'userId' does not exist on type 'User'

# 3. Fix the type error
# Edit: src/components/Profile.tsx
# Change: user.userId → user.id

# 4. Stage the fix
git add src/components/Profile.tsx

# 5. Commit again
git commit
# ✅ All checks pass!
```

---

### Example 4: Working with Generated Types

**Scenario:** Update Payload collection schema

```bash
# 1. Create branch
git checkout -b feat/add-user-bio

# 2. Update collection
# Edit: src/collections/Users.ts
# Add: { name: 'bio', type: 'textarea' }

# 3. Generate types
pnpm generate:types

# 4. Update components using User type
# Edit: src/components/UserProfile.tsx

# 5. Stage changes (including generated types)
git add src/collections/Users.ts src/payload-types.ts src/components/UserProfile.tsx

# 6. Commit
git commit -m "feat: Add user bio field

Added biography field to user profiles allowing users to write a short
description about themselves. Updated profile component to display bio."

# ✅ All checks pass
```

---

### Example 5: Emergency Hotfix

**Scenario:** Production is down, need to commit immediately

```bash
# 1. Create hotfix branch from main
git checkout main
git checkout -b fix/critical-production-error

# 2. Make minimal fix
# Edit: src/lib/database.ts

# 3. Quick verification
pnpm build
pnpm test:unit

# 4. If hooks would take too long, skip them
SKIP_HOOKS=1 git commit -m "fix: Critical database connection error

Emergency fix for production database connection timeout issue.
Increased connection timeout and added retry logic.

Note: Skipped hooks for emergency deployment."

# 5. Push and deploy immediately
git push -u origin fix/critical-production-error

# 6. Create PR and let CI validate
# 7. Follow up with proper cleanup if needed
```

---

## Additional Hooks

### commit-msg Hook

**When:** After writing commit message, before commit is created

**What:** Validates commit message format with commitlint

**Fix errors:** Follow [Commit Message Format](#commit-message-format) section

---

### pre-push Hook

**When:** Before pushing commits to remote

**What:** Runs integration tests (`pnpm test:int`)

**Error message:**

```
❌ Integration tests failed. Push cancelled.
```

**Fix:**

```bash
# Run integration tests locally
pnpm test:int

# Fix failing tests
# Then push again
git push
```

**Skip:**

```bash
git push --no-verify
# or
SKIP_HOOKS=1 git push
```

---

### post-commit Hook (Informational)

**When:** After successful commit

**What:** Displays helpful reminders

**Example output:**

```
📝 Reminder: package.json version changed
Don't forget to update CHANGELOG.md
```

**Action:** No action required, just informational

---

### post-merge Hook (Automatic)

**When:** After `git merge` or `git pull`

**What:** Automatically runs maintenance tasks

**Actions:**

1. Auto-runs `pnpm install` if `pnpm-lock.yaml` changed
2. Auto-generates types if Payload schema changed

**Output:**

```
📦 Dependencies changed, running pnpm install...
✅ Dependencies updated

🔧 Payload schema changed, generating types...
✅ Types generated
```

---

## Quick Reference

### Commit Checklist

**Required (enforced by pre-commit):**
- [ ] On a properly named feature branch (`feat/`, `fix/`, etc.)
- [ ] No secrets in staged files
- [ ] No CSS/SCSS files (use Tailwind)
- [ ] Commit message follows conventional commits format
- [ ] Commit body has at least 20 characters

**Automatic (handled by hooks):**
- ✅ Formatting auto-fixed by Prettier
- ✅ Linting auto-fixed by ESLint
- ✅ Type checking on staged files

**Optional (validated in CI):**
- Build verification runs in CI
- Full test suite runs in CI
- Can run locally with `pnpm ci:local` if desired

### Common Commands

```bash
# Create feature branch
git checkout -b feat/feature-name

# Check what will be committed
git diff --cached

# Run checks manually before commit
pnpm lint
pnpm typecheck
pnpm build
pnpm test:unit

# Commit with editor (recommended)
git commit

# Skip hooks (emergency only)
SKIP_HOOKS=1 git commit -m "message"
git commit --no-verify
```

### Getting Help

- **Pre-commit hook details:** [.husky/pre-commit](../../.husky/pre-commit)
- **Commit message rules:** [commitlint.config.js](../../commitlint.config.js)
- **Styling guidelines:** [AGENTS.md](../../AGENTS.md)
- **Project setup:** [CLAUDE.md](../../CLAUDE.md)

---

**Last Updated:** 2026-01-12

**Maintainer:** Keep this guide updated when hooks change or new patterns emerge.
