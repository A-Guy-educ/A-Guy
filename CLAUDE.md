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

### Development Server

- **Start dev**: `pnpm dev` - Access at http://localhost:3000 (frontend) and /admin (admin panel)
- **Clean restart**: `rm -rf .next && pnpm dev` - Clear Next.js cache and restart

### Database

- **Start DB**: `docker-compose up -d` - Start MongoDB via Docker
- **Stop DB**: `docker-compose down` - Stop MongoDB
- **Check status**: `docker-compose ps`
- **View logs**: `docker-compose logs -f`

### Code Generation

- **Generate types**: `pnpm generate:types` - Regenerate Payload TypeScript types (run after schema changes)
- **Generate importmap**: `pnpm generate:importmap` - Regenerate admin import map (run after adding admin components)

### Quality Gates

- **Typecheck**: `pnpm -s tsc --noEmit`
- **Lint**: `pnpm -s lint`
- **Lint fix**: `pnpm lint:fix`
- **Format check**: `pnpm -s format` or `pnpm -s prettier:check`
- **Format fix**: `pnpm format:fix` or `pnpm prettier:write`

### Testing

- **Integration tests**: `pnpm test:int`
- **E2E tests**: `pnpm test:e2e`
- **E2E headed**: `pnpm exec playwright test --headed`
- **E2E UI mode**: `pnpm exec playwright test --ui`
- **Specific test**: `pnpm exec vitest run tests/int/<file>.int.spec.ts --config ./vitest.config.mts`

### Translations

When adding translations, update both:

- `messages/en.json` - English
- `messages/he.json` - Hebrew

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
