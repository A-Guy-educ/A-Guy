# A-Guy Conventions

## Code Organization

- **Imports**: Always use `@/` aliases for src imports; relative imports within same directory only
- **Immutability**: Use spread operator for updates, never mutate directly
- **Validation**: Zod schemas for all user input and external API responses
- **Errors**: Try-catch with detailed server logging and user-friendly UI messages
- **No console.log**: Use proper logging; no hardcoded secrets (use env vars)

## Design System (CRITICAL)

- All colors/tokens centralized in [globals.css](<./src/app/(frontend)/globals.css>) and [tailwind.tokens.mjs](./tailwind.tokens.mjs)
- Never create custom colors or styles outside design system
- Use existing CSS variables and Tailwind classes only

## Testing & Git

- **TDD**: Write tests first, 80%+ coverage required (unit + integration + E2E)
- **Commits**: Format: `<type>: <description>` (feat, fix, refactor, docs, test, chore)
- **Documentation**: See [CLAUDE.md](./CLAUDE.md) for dev commands, [AGENTS.md](./AGENTS.md) for patterns
