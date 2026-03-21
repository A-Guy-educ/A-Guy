# Automation Guide

This project includes comprehensive automation to streamline development, testing, deployment, and maintenance workflows.

## Table of Contents

- [Setup Automation](#setup-automation)
- [Development Automation](#development-automation)
- [CI/CD Automation](#cicd-automation)
- [Vercel Preview Automation](#vercel-preview-automation)
- [Code Quality Automation](#code-quality-automation)
- [Database Automation](#database-automation)
- [Dependency Management](#dependency-management)

---

## Setup Automation

### First-Time Setup

**`pnpm setup`** - Automated environment setup

Automates the entire first-time development setup:
- ✅ Checks prerequisites (Node.js, pnpm, Docker)
- ✅ Creates `.env` file from template
- ✅ Generates secure secrets (PAYLOAD_SECRET, CRON_SECRET, PREVIEW_SECRET)
- ✅ Starts MongoDB via Docker
- ✅ Waits for MongoDB to be ready
- ✅ Generates Payload TypeScript types
- ✅ Runs quality checks (typecheck, lint)

**Usage:**
```bash
pnpm setup
```

**What happens:**
1. Validates Node.js ≥20.9.0, pnpm ≥9, Docker installed
2. Copies `.env.example` → `.env`
3. Generates cryptographically secure secrets
4. Starts MongoDB container
5. Generates types from Payload config
6. Verifies code quality

**Time saved:** ~10-15 minutes per developer onboarding

---

### Health Diagnostics

**`pnpm doctor`** - Environment health check

Comprehensive diagnostic tool that checks:
- ✅ Node.js version compatibility
- ✅ pnpm version compatibility
- ✅ Docker availability and status
- ✅ MongoDB container status
- ✅ MongoDB connection health
- ✅ Environment variables (presence and validity)
- ✅ Port 3000 availability
- ✅ Node modules integrity
- ✅ Git hooks installation
- ✅ Disk space availability

**Usage:**
```bash
pnpm doctor
```

**Output:**
- ✅ Green checkmarks for passing checks
- ❌ Red errors for failures
- ⚠️  Yellow warnings for issues
- 💡 Suggested fixes for each issue

**When to run:**
- After cloning the repository
- When experiencing development issues
- Before starting work on a new feature
- After system updates or configuration changes

---

### Environment Validation

**`pnpm validate:env`** - Validate environment variables

Validates all required environment variables before build or deployment:
- Checks for required variables
- Detects placeholder values (e.g., `YOUR_SECRET_HERE`)
- Validates variable formats
- Shows missing or invalid configuration

**Required variables:**
- `DATABASE_URL` - MongoDB connection string
- `PAYLOAD_SECRET` - JWT encryption secret
- `NEXT_PUBLIC_SERVER_URL` - Public server URL
- `CRON_SECRET` - Cron job authentication
- `PREVIEW_SECRET` - Preview mode validation

**Usage:**
```bash
pnpm validate:env
```

**Exit codes:**
- `0` - All required variables valid
- `1` - Missing or invalid variables

---

## Development Automation

### Development Server

```bash
# Start development server
pnpm dev

# Clean restart (clears Next.js cache)
pnpm dev:clean
```

### Database Management

```bash
# Start MongoDB
pnpm db:start

# Stop MongoDB
pnpm db:stop

# Restart MongoDB
pnpm db:restart

# Reset database (deletes all data)
pnpm db:reset

# View MongoDB logs (live stream)
pnpm db:logs
```

### Cache Management

```bash
# Clean build cache
pnpm clean

# Full clean (requires reinstall)
pnpm clean:all
```

---

## CI/CD Automation

### GitHub Actions Workflows

#### 1. **CI Workflow** (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` branch.

**Three parallel jobs:**

**Quality Gates:**
- TypeScript type checking
- ESLint linting
- Prettier formatting check
- npm security audit (continue-on-error)
- ⚡ **Cached:** pnpm store

**Tests:**
- Unit tests (Vitest)
- Integration tests (Vitest + Testcontainers)
- E2E tests (Playwright)
- ⚡ **Cached:** pnpm store, Playwright browsers
- 📦 Uploads Playwright reports on failure

**Build:**
- Production build verification
- Sitemap generation
- ⚡ **Cached:** pnpm store, Next.js build cache

**Performance improvements:**
- pnpm store cache: 3-5x faster dependency installation
- Playwright browser cache: Skip browser download when unchanged
- Next.js build cache: Faster incremental builds
- Conditional Playwright install: Only installs if cache miss

**Estimated time savings:** 50-70% faster CI runs

---

#### 2. **Dev→Main Merge Workflow** (`.github/workflows/merge-dev-to-main.yml`)

Automated merge from `dev` to `main` branch.

**Triggers:**
- Manual workflow dispatch
- Scheduled: Weekly on Mondays at 9 AM UTC

**Features:**
- Smart conflict resolution for lock files
- Automated commit with `[skip ci]`
- Preserves commit history

---

### Local CI Testing

```bash
# Run full CI suite locally
pnpm ci:local
```

Runs:
1. TypeScript type check
2. ESLint
3. All tests (integration + E2E)

---

## Vercel Preview Automation

### Preview Comment Bot

**Workflow:** `.github/workflows/preview-comment.yml`

Automatically comments on PRs when Vercel preview deployments succeed.

**Features:**
- 🔗 Quick links to preview site, admin panel, API
- ✅ Testing checklist
- ℹ️ Deployment info (commit SHA, timestamp)
- 🔄 Updates existing comment on new deployments

**Example comment:**
```markdown
## 🚀 Preview Deployment Ready

### 🔗 Quick Links
- 🌐 Preview Site: https://a-guy-pr-123.vercel.app
- 👤 Admin Panel: https://a-guy-pr-123.vercel.app/admin
- 📖 API: https://a-guy-pr-123.vercel.app/api

### 📋 Testing Checklist
- [ ] Homepage loads correctly
- [ ] Admin login works
- [ ] Forms submit successfully
- [ ] Images load properly
- [ ] No console errors
```

---

### Preview Validation

**Workflow:** `.github/workflows/preview-validation.yml`

Runs automated smoke tests on every Vercel preview deployment.

**Tests:**
1. **Homepage** - Verifies main page loads (HTTP 200-399)
2. **Admin Panel** - Verifies admin interface loads
3. **API Health** - Tests API endpoint (continue-on-error)
4. **Performance** - Measures response time (<3s = good)

**Outputs:**
- ✅ Status table posted as PR comment
- ❌ Fails job if critical tests fail
- ⚠️  Warnings for non-critical issues

**Example validation comment:**
```markdown
## ✅ Preview Validation Results

| Test | Status | Notes |
|------|--------|-------|
| Homepage | ✅ success | Main page loads |
| Admin Panel | ✅ success | Admin interface loads |
| API | ✅ success | API endpoint check |
| Performance | ✅ success | Response time check |
```

---

## Code Quality Automation

### Pre-commit Hooks (Husky)

Automatically runs on every commit:

**1. Secret Detection** (`.husky/check-secrets`)
- Blocks commits containing `.env` files
- Blocks commits with API keys or tokens
- Prevents accidental secret leaks

**2. CSS/SCSS Blocking** (`.husky/check-no-css`)
- Enforces Tailwind-only design system
- Blocks `.css` and `.scss` file changes
- Maintains design system consistency

**3. Lint-Staged**
- Auto-formats changed files (Prettier)
- Runs ESLint on changed files
- Type checks changed TypeScript files
- Regenerates AI documentation when relevant files change
- Validates README links

**4. Commitlint**
- Enforces conventional commit format
- Requires meaningful commit messages (≥20 chars)
- Examples:
  - `feat: add user authentication`
  - `fix: resolve login redirect issue`
  - `docs: update setup instructions`

---

### Commit Message Format

**Format:** `<type>: <description>`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Test changes
- `chore` - Build/tooling changes

**Requirements:**
- Description must be ≥20 characters
- Use lowercase
- No period at the end

---

## Database Automation

### Docker Compose Management

All database operations are automated via npm scripts:

```bash
# Start MongoDB (detached mode)
pnpm db:start
# → docker-compose up -d

# Stop MongoDB
pnpm db:stop
# → docker-compose down

# Restart MongoDB
pnpm db:restart
# → docker-compose restart

# Reset database (destructive!)
pnpm db:reset
# → docker-compose down -v && docker-compose up -d

# Stream logs
pnpm db:logs
# → docker-compose logs -f mongo
```

---

## Dependency Management

### Dependabot Configuration

**File:** `.github/dependabot.yml`

Automated dependency updates with intelligent grouping.

**Update schedule:**
- **Frequency:** Weekly (Mondays at 9 AM)
- **PR limit:** 10 simultaneous PRs
- **Auto-labels:** `dependencies`, `automated`

**Grouped updates:**

**Development dependencies:**
- Minor + patch updates grouped together
- Reduces PR noise

**Production dependencies:**
- Minor + patch updates grouped together
- Critical updates prioritized

**Ignored major updates:**
- `next`, `react`, `react-dom`, `payload`, `@payloadcms/*`
- Reason: Breaking changes require manual review

**Also monitors:**
- Docker images (docker-compose.yml)
- GitHub Actions versions

**Benefits:**
- ✅ Automated security updates
- ✅ Keeps dependencies current
- ✅ Reduces manual maintenance
- ✅ Groups related updates

---

## AI Documentation Automation

### Automated Documentation Generation

**Pre-commit hooks trigger regeneration:**

**1. Doc Chunks** (`pnpm ai:generate-docs`)
- Generates AI-friendly documentation chunks
- Triggered when AGENTS.md or DESIGN_SYSTEM.md changes
- Creates optimized docs for AI agents

**2. Pattern Index** (`pnpm ai:generate-patterns`)
- Auto-generates index of code patterns
- Triggered when collections or components change
- Helps AI understand project structure

**3. README Index** (`pnpm ai:generate-readme-index`)
- Generates README navigation
- Validates internal links
- Triggered when README.md changes

**4. Link Validation** (`pnpm validate:readme-links`)
- Checks all links in README.md
- Ensures documentation stays current
- Runs on every commit

---

## Best Practices

### When to Use Each Tool

**`pnpm setup`**
- ✅ First-time repository setup
- ✅ After cloning to a new machine
- ✅ When `.env` is missing or corrupted

**`pnpm doctor`**
- ✅ Troubleshooting development issues
- ✅ After system updates
- ✅ Before starting work
- ✅ In CI/CD health checks

**`pnpm validate:env`**
- ✅ Before building for production
- ✅ In CI/CD pipelines
- ✅ After updating .env.example
- ✅ When onboarding new developers

**`pnpm ci:local`**
- ✅ Before pushing commits
- ✅ Before creating pull requests
- ✅ To verify CI will pass
- ✅ During code reviews

---

## Troubleshooting

### Common Issues

**1. Setup fails with "Docker not running"**
```bash
# Start Docker Desktop or docker daemon
# Then retry: pnpm setup
```

**2. Doctor reports port 3000 in use**
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm dev
```

**3. Validation fails with placeholder values**
```bash
# Regenerate secrets
pnpm setup

# Or manually generate
openssl rand -hex 32
```

**4. CI cache issues**
```bash
# Force cache refresh by bumping pnpm-lock.yaml
pnpm install

# Or clear GitHub Actions cache via UI
```

---

## Future Automation Opportunities

### Planned Enhancements

- [ ] **Database migrations** - Automated schema change tracking
- [ ] **Bundle size tracking** - Automated performance regression detection
- [ ] **Visual regression testing** - Automated UI screenshot comparison
- [ ] **Test coverage enforcement** - Minimum coverage thresholds
- [ ] **Changelog generation** - Auto-generate from conventional commits
- [ ] **Release automation** - Automated version bumping and tagging

---

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Husky Documentation](https://typicode.github.io/husky/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Vercel Deployment Hooks](https://vercel.com/docs/deployments/deployment-hooks)

---

**Questions?** Check [CLAUDE.md](../CLAUDE.md) for quick command reference or [AGENTS.md](../AGENTS.md) for comprehensive project documentation.
