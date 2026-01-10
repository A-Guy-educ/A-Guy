# Development Scripts

This directory contains utility scripts for development, maintenance, and automation tasks.

## Script Categories

### 1. Setup & Environment Scripts

#### `setup.ts`

**Purpose:** Automated first-time development environment setup

**Usage:**

```bash
pnpm setup
```

**What it does:**

1. Checks prerequisites (Node.js, pnpm, Docker)
2. Creates `.env` file from `.env.example`
3. Generates secure secrets (PAYLOAD_SECRET)
4. Starts MongoDB via Docker Compose
5. Generates Payload TypeScript types
6. Runs initial quality checks

**When to use:**

- First time setting up the project
- After cloning the repository
- When `.env` file is missing or corrupted

#### `validate-env.ts`

**Purpose:** Validate required environment variables

**Usage:**

```bash
pnpm validate:env
```

**What it does:**

- Checks that `.env` file exists
- Validates all required environment variables are present
- Verifies variable formats (URLs, secrets, etc.)
- Reports missing or invalid variables

**When to use:**

- Before deploying to production
- After updating `.env.example`
- When debugging environment-related issues

#### `doctor.ts`

**Purpose:** Comprehensive health check for development environment

**Usage:**

```bash
pnpm doctor
```

**What it does:**

- ✅ Node.js version compatibility
- ✅ pnpm version and installation
- ✅ Docker availability and status
- ✅ MongoDB connection and health
- ✅ Required environment variables
- ✅ Port availability (3000, 27017)
- ✅ Disk space
- ✅ Git hooks installation
- ✅ Dependencies installed correctly

**When to use:**

- When something isn't working and you don't know why
- Before starting development after environment changes
- After OS updates or Docker updates
- When onboarding new developers

**Example output:**

```
✅ Node.js: v20.11.0 (compatible)
✅ pnpm: 9.12.3 (compatible)
✅ Docker: running
✅ MongoDB: connected
⚠️  Port 3000: in use (may need to kill existing process)
✅ Environment: all required variables present
```

### 2. Documentation Scripts

#### `generate-readme-index.ts`

**Purpose:** Auto-generate table of contents for README.md

**Usage:**

```bash
pnpm generate:readme-index
```

**What it does:**

- Scans main `README.md` for headings
- Generates nested table of contents
- Updates `<!-- INDEX -->` section in README
- Preserves manual content outside the index

**When to use:**

- After adding new sections to README
- After reorganizing README structure
- Automatically in pre-commit hook

#### `validate-readme-links.ts`

**Purpose:** Check for broken links in README and documentation

**Usage:**

```bash
pnpm validate:readme-links
```

**What it does:**

- Finds all markdown files in the project
- Extracts internal links (file paths, headings)
- Validates that linked files exist
- Checks that linked headings exist in target files
- Reports broken links with locations

**When to use:**

- Before committing documentation changes
- After refactoring file structure
- Automatically in pre-commit hook

#### `generate-pattern-index.ts`

**Purpose:** Generate searchable index of code patterns in AGENTS.md

**Usage:**

```bash
pnpm generate:pattern-index
```

**What it does:**

- Extracts code patterns from AGENTS.md
- Creates searchable index of examples
- Generates quick reference guide
- Updates pattern cross-references

**When to use:**

- After adding new patterns to AGENTS.md
- After reorganizing documentation

#### `generate-doc-chunks.ts`

**Purpose:** Split documentation into searchable chunks for AI context

**Usage:**

```bash
pnpm generate:doc-chunks
```

**What it does:**

- Processes AGENTS.md and other documentation
- Splits into semantic chunks (by heading, topic, etc.)
- Generates embeddings for semantic search
- Creates index for fast lookup

**When to use:**

- After major documentation updates
- For improving AI assistant context retrieval

#### `test-doc-search.ts`

**Purpose:** Test documentation search functionality

**Usage:**

```bash
pnpm test:doc-search
```

**What it does:**

- Tests semantic search across documentation
- Validates chunk retrieval accuracy
- Benchmarks search performance

**When to use:**

- After updating documentation chunking logic
- Verifying search quality

#### `test-smart-loader.ts`

**Purpose:** Test smart context loading for AI assistants

**Usage:**

```bash
pnpm test:smart-loader
```

**What it does:**

- Tests intelligent documentation loading
- Validates context relevance
- Measures loading performance

**When to use:**

- After updating smart loader logic
- Debugging context issues

### 3. Quality & Validation Scripts

#### `check-branch.ts`

**Purpose:** Validate branch naming conventions

**Usage:**

```bash
pnpm check:branch
```

**What it does:**

- Checks current Git branch name against naming patterns
- Enforces consistent branch naming across the team
- Reports violations with helpful examples

**Valid patterns:**

- `feat/<description>` - New features
- `fix/<description>` - Bug fixes
- `chore/<description>` - Maintenance tasks
- `docs/<description>` - Documentation changes
- `refactor/<description>` - Code refactoring
- `test/<description>` - Test additions/changes
- `security/<description>` - Security fixes
- `main` or `dev` - Main branches

**When to use:**

- Automatically enforced in pre-commit hook
- Manually when creating new branches
- In CI/CD to validate PR branch names

#### `pre-release-check.ts`

**Purpose:** Comprehensive pre-release validation

**Usage:**

```bash
pnpm check:release
```

**What it does:**

- ✅ Ensures working directory is clean
- ✅ Verifies on main branch
- ✅ Checks sync with remote
- ✅ Runs typecheck
- ✅ Runs linting
- ✅ Runs all tests
- ✅ Validates build succeeds
- ✅ Checks for TODO/FIXME in production code

**When to use:**

- Before creating a release
- Before merging to main
- As part of release workflow
- When validating deployment readiness

**Example output:**

```
🔍 Running pre-release checks...

Checking: Clean working directory... ✅
Checking: On main branch... ✅
Checking: Up to date with remote... ✅
Checking: Typecheck passes... ✅
Checking: Linting passes... ✅
Checking: All tests pass... ✅
Checking: Build succeeds... ✅
Checking: No TODO/FIXME in src/... ✅

============================================================
RESULTS:
============================================================
✅ Clean working directory
✅ On main branch
✅ Up to date with remote
✅ Typecheck passes
✅ Linting passes
✅ All tests pass
✅ Build succeeds
✅ No TODO/FIXME in src/
============================================================

✅ All pre-release checks passed!
You can now proceed with the release.
```

### 4. Database Scripts

**Note:** Database operations are primarily handled via `docker-compose` commands. See [package.json](../package.json) for aliases.

```bash
# Start MongoDB
pnpm db:start        # docker-compose up -d

# Stop MongoDB
pnpm db:stop         # docker-compose down

# Restart MongoDB
pnpm db:restart      # docker-compose restart

# Reset MongoDB (delete all data)
pnpm db:reset        # docker-compose down -v && docker-compose up -d

# View logs
pnpm db:logs         # docker-compose logs -f mongo
```

## Script Execution

All scripts use **tsx** (TypeScript execution) and can be run with:

```bash
# Via pnpm (recommended)
pnpm <script-name>

# Direct execution (if script is executable)
./scripts/<script-name>.ts

# Manual tsx execution
pnpm tsx scripts/<script-name>.ts
```

## Common Patterns

### Creating a New Script

1. **Create script file:**

   ```typescript
   #!/usr/bin/env tsx
   /**
    * Script purpose and description
    *
    * Run: pnpm script-name
    *
    * Detailed explanation of what this script does
    */

   import { execSync } from 'child_process'

   async function main() {
     try {
       console.log('Starting...')
       // Script logic here
       console.log('✅ Complete!')
     } catch (error) {
       console.error('❌ Error:', error)
       process.exit(1)
     }
   }

   main()
   ```

2. **Make executable:**

   ```bash
   chmod +x scripts/new-script.ts
   ```

3. **Add to package.json:**

   ```json
   {
     "scripts": {
       "script-name": "tsx scripts/new-script.ts"
     }
   }
   ```

4. **Document in this README**

### Terminal Output Helpers

Scripts use consistent color coding:

```typescript
// Color constants
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m', // Success
  yellow: '\x1b[33m', // Warning
  red: '\x1b[31m', // Error
  blue: '\x1b[34m', // Info
  cyan: '\x1b[36m', // Section header
}

function success(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`)
}

function warning(message: string) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`)
}

function error(message: string) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`)
}

function info(message: string) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`)
}
```

### Running Shell Commands

```typescript
import { execSync } from 'child_process'

function runCommand(command: string, options = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'inherit', // Show output in real-time
      ...options,
    })
    return output
  } catch (error) {
    throw new Error(`Command failed: ${command}`)
  }
}

// Usage
runCommand('pnpm install')
runCommand('docker-compose up -d')
```

### File System Operations

```typescript
import * as fs from 'fs'
import * as path from 'path'

// Read file
const content = fs.readFileSync('/path/to/file.txt', 'utf-8')

// Write file
fs.writeFileSync('/path/to/file.txt', 'content', 'utf-8')

// Check if file exists
if (fs.existsSync('/path/to/file.txt')) {
  // File exists
}

// Create directory
fs.mkdirSync('/path/to/dir', { recursive: true })

// List files in directory
const files = fs.readdirSync('/path/to/dir')
```

### Error Handling

```typescript
async function main() {
  try {
    // Script logic
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1) // Exit with error code
  }
}

main()
```

## Integration with Development Workflow

### Pre-commit Hooks

Some scripts run automatically via Husky pre-commit hooks:

**`.husky/pre-commit`:**

```bash
#!/bin/sh
pnpm validate:readme-links    # Check documentation links
pnpm generate:readme-index    # Update README table of contents
# ... other checks
```

See [.husky/pre-commit](../.husky/pre-commit) for complete list.

### CI/CD Integration

Scripts also run in CI/CD pipelines:

**GitHub Actions workflow:**

```yaml
- name: Setup
  run: pnpm setup

- name: Validate environment
  run: pnpm validate:env

- name: Health check
  run: pnpm doctor

- name: Validate docs
  run: pnpm validate:readme-links
```

## Troubleshooting

### Script won't execute

**Problem:** Permission denied

**Solution:**

```bash
chmod +x scripts/<script-name>.ts
```

### Module not found

**Problem:** TypeScript imports fail

**Solution:**

```bash
# Install dependencies
pnpm install

# Check tsconfig.json paths are correct
```

### Command not found (pnpm)

**Problem:** Script runs commands that aren't in PATH

**Solution:**

```bash
# Use full paths or pnpm exec
execSync('pnpm exec playwright test')
```

### Script hangs

**Problem:** Waiting for user input or async operation

**Solution:**

- Ensure all async operations use `await`
- Use `stdio: 'inherit'` to see command output
- Add timeouts to long-running operations

## Best Practices

### DO:

- ✅ Add shebang: `#!/usr/bin/env tsx`
- ✅ Include JSDoc comment explaining purpose
- ✅ Use colored output for clarity
- ✅ Handle errors gracefully
- ✅ Exit with proper code (`process.exit(1)` on error)
- ✅ Document in this README
- ✅ Add to `package.json` scripts
- ✅ Make scripts idempotent (safe to run multiple times)
- ✅ Test scripts thoroughly before committing

### DON'T:

- ❌ Hardcode paths (use `path.join`, `process.cwd()`)
- ❌ Suppress errors silently
- ❌ Make destructive operations without confirmation
- ❌ Depend on scripts in specific order (make independent)
- ❌ Use `console.log` for everything (use semantic helpers)
- ❌ Commit sensitive data or secrets

## Related Documentation

- [AGENTS.md](../AGENTS.md) - Comprehensive development guide
- [package.json](../package.json) - NPM scripts reference
- [.husky/](../.husky/) - Git hooks that run scripts
- [docker-compose.yml](../docker-compose.yml) - Database setup

## Quick Reference

### Most Used Scripts

```bash
# First-time setup
pnpm setup                    # Complete environment setup

# Daily development
pnpm dev                      # Start dev server
pnpm db:start                 # Start MongoDB
pnpm doctor                   # Check environment health

# Before committing
pnpm validate:readme-links    # Check documentation
pnpm generate:readme-index    # Update README TOC
pnpm typecheck                # Type check
pnpm lint                     # Lint check
pnpm format                   # Format code

# Maintenance
pnpm clean                    # Clear cache
pnpm db:reset                 # Reset database
pnpm generate:types           # Regenerate Payload types
```

### Script Output Conventions

- ✅ **Green checkmark**: Success
- ⚠️ **Yellow warning**: Non-critical issue
- ❌ **Red X**: Error/failure
- ℹ️ **Blue info**: Informational message
- 🔧 **Wrench**: Action being performed
- 🎯 **Target**: Goal or endpoint
