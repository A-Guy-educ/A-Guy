# Claude Code Reference

This file serves as the entry point for Claude Code (AI assistant) when working on this project.

---

## Documentation

**Read [AGENTS.md](AGENTS.md) - it contains everything you need:**

- Core principles and best practices
- Project structure and architecture
- Payload CMS patterns (collections, fields, hooks, access control)
- Security patterns (CRITICAL - access control, transactions, hooks)
- Component development
- Custom endpoints
- Type safety guidelines
- Exercise system architecture
- Authentication patterns
- Examples and code snippets

**Read [claude-internal.md](claude-internal.md) - Internal team guidelines:**

- Internal conventions and patterns specific to this project

---

## Quick Commands Reference

These commands are frequently used during development. Suggest them proactively when relevant.

### Setup & Diagnostics

- **Setup environment**: `pnpm setup` - Automated first-time setup (creates .env, starts DB, generates types)
- **Health check**: `pnpm doctor` - Diagnose environment issues and verify configuration
- **Validate env**: `pnpm validate:env` - Check required environment variables

### Development Server

- **Start dev**: `pnpm dev` - Access at http://localhost:3000 (frontend) and /admin (admin panel)
- **Clean restart**: `pnpm dev:clean` - Clear Next.js cache and restart (shortcut for `rm -rf .next && pnpm dev`)

### Database

- **Start DB**: `pnpm db:start` - Start MongoDB via Docker (shortcut for `docker-compose up -d`)
- **Stop DB**: `pnpm db:stop` - Stop MongoDB (shortcut for `docker-compose down`)
- **Restart DB**: `pnpm db:restart` - Restart MongoDB container
- **Reset DB**: `pnpm db:reset` - Delete all data and restart MongoDB
- **View logs**: `pnpm db:logs` - Stream MongoDB logs (shortcut for `docker-compose logs -f mongo`)

### Code Generation

- **Generate types**: `pnpm generate:types` - Regenerate Payload TypeScript types (run after schema changes)
- **Generate importmap**: `pnpm generate:importmap` - Regenerate admin import map (run after adding admin components)

### Quality Gates

- **Typecheck**: `pnpm typecheck`
- **Lint**: `pnpm lint`
- **Lint fix**: `pnpm lint:fix`
- **Format check**: `pnpm format:check`
- **Format fix**: `pnpm format`
- **Run all checks locally**: `pnpm ci:local` - Run typecheck, lint, and all tests

### Testing

- **All tests**: `pnpm test` - Run both integration and E2E tests
- **Integration tests**: `pnpm test:int`
- **E2E tests**: `pnpm test:e2e`
- **E2E headed**: `pnpm exec playwright test --headed`
- **E2E UI mode**: `pnpm exec playwright test --ui`
- **Specific test**: `pnpm exec vitest run tests/int/<file>.int.spec.ts --config ./vitest.config.mts`

### Maintenance

- **Clean cache**: `pnpm clean` - Remove .next cache and build artifacts
- **Clean all**: `pnpm clean:all` - Remove node_modules, cache, and lock file (requires reinstall)

### Translations

When adding translations, update both:

- `messages/en.json` - English
- `messages/he.json` - Hebrew

### Git & Commits

- **Commit guide**: See [docs/specs/COMMIT_GUIDE.md](docs/specs/COMMIT_GUIDE.md) - Complete guide to passing pre-commit hooks
- **Quick tip**: Use `git commit` (opens editor) for proper commit messages with body
- **Emergency skip**: `SKIP_HOOKS=1 git commit` (use sparingly)

---

## Vector Search Setup

The project includes MongoDB Atlas Vector Search for AI-powered long-term memory:

- **Setup Guide**: [docs/VECTOR-SEARCH-SETUP.md](docs/VECTOR-SEARCH-SETUP.md) - Complete setup instructions
- **Quick Reference**: [docs/features/chat-context/VECTOR-INDEX-SETUP-QUICK.md](docs/features/chat-context/VECTOR-INDEX-SETUP-QUICK.md)
- **Index Definition**: `infra/atlas/vector-index.memory_items.v1.json`
- **Verify Setup**: `pnpm verify:vector-index`

**Requirements**: MongoDB Atlas M10+ cluster, OpenAI API key

---

## Available Skills

Use these skills for complex workflows:

- `/implement` - Full implementation workflow (branch, tests, commit, PR, CI)
- `/new-collection` - Generate new Payload collection with best practices
- `/new-block` - Create new layout builder block
- `/add-ui-component` - Add shadcn/ui component
- `/security-review` - Security audit of code changes
- `/quality-check` - Run all quality gates
- `/ux-engineer-expert` - UI/UX component architecture guidance

Invoke skills using the Skill tool when needed.

---

## AI Agent Tools

This codebase includes tools to help AI agents work efficiently:

### Smart Documentation Loading

Use SmartDocLoader for context-aware documentation loading:

```typescript
import { SmartDocLoader } from '@/lib/ai/smart-doc-loader'

// Creating a collection
const docs = SmartDocLoader.forCollection('create')
console.log(docs.estimatedTokens) // ~380 tokens

// Creating a component
const docs = SmartDocLoader.forComponent('create')
// Returns: ~335 tokens, quick reference tier

// Creating an endpoint
const docs = SmartDocLoader.forEndpoint('create')
// Returns: ~228 tokens, quick reference tier

// Debugging
const docs = SmartDocLoader.forDebugging('collection')
// Returns: ~1158 tokens, deep reference tier
```

### Documentation Search

Search for specific information:

```typescript
import { getDocSearch } from '@/lib/ai/doc-search'

const search = getDocSearch()
const results = search.query('How do I create a published collection?', {
  limit: 5,
  category: 'quick-reference',
})
```

### Pattern Discovery

Find examples of specific patterns:

```typescript
// Load pattern index
const index = require('./docs/ai/indexes/pattern-index.json')

// Find all files using RBAC pattern
const rbacFiles = index.patterns['rbac'].files
```

See [docs/ai/QUICK-START.md](docs/ai/QUICK-START.md) for full guide.

---

## Import Style

**Always use `@/` aliases** for src imports:

```typescript
// ✅ Correct
import { getPayload } from 'payload'
import { User } from '@/payload-types'
import { SmartDocLoader } from '@/lib/ai/smart-doc-loader'

// ❌ Wrong
import { SmartDocLoader } from '../../../lib/ai/smart-doc-loader'
```

**Exception**: Use relative imports within the same directory:

```typescript
// ✅ Correct (same directory)
import { helper } from './helper'
```
