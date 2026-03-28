# Conventions

## Import Style

- Use `@/` aliases for all src imports (e.g., `@/server/services`, `@/payload-types`)
- Relative imports only within same directory
- Exception: Payload imports use named imports (`import { getPayload } from 'payload'`)

## Code Patterns

- **Immutability**: Use spread operator for updates, never mutate objects
- **Error Handling**: Try-catch with async/await, descriptive user messages
- **Validation**: Zod schemas at system boundaries
- **API Response**: `{success, data?, error?, meta?}` envelope format

## File Organization

- Max 800 lines per file, prefer small focused files
- High cohesion (related code together)
- No `lib/` folder; use domain-specific directories

## Commit Messages

- Format: `<type>: <description>` (feat, fix, refactor, docs, test, chore)
- Use `git commit` for editor mode (enables body)
- Follow [COMMIT_GUIDE.md](./docs/specs/COMMIT_GUIDE.md)

## Quality Gates

- **80%+ test coverage** required
- **TypeScript strict mode** enforced
- **No console.log** in production
- **No hardcoded secrets** (use env vars)
- **Run `pnpm ci:local`** before push
