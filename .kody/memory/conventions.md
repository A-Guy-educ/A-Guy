# Conventions

## File Metadata

All source files include JSDoc headers:

```typescript
/**
 * @fileType utility|api-route|hook|component
 * @domain auth|media|exercises|...
 * @pattern oauth|embed-provider|...
 * @ai-summary Brief description
 */
```

## TypeScript

- Strict mode enabled
- Use `@/` path aliases (e.g., `@/infra/auth`, `@/server/services`)
- NO `lib/` folder—use domain-specific directories instead
- Type generation required after schema changes

## Code Patterns

- **Immutability**: Spread operator for updates, never mutate in-place
- **Error Handling**: Try-catch with descriptive error messages
- **Validation**: Zod schemas for input validation
- **Security**: Environment variables only, no hardcoded secrets
- **Transactions**: Always pass `req` to nested Payload operations
- **OAuth**: State-based CSRF protection, email verification, collision handling

## Styling

See design system in [src/app/(frontend)/globals.css](<./src/app/(frontend)/globals.css>) and [tailwind.tokens.mjs](./tailwind.tokens.mjs). Key rules:

- Use semantic design tokens (colors, typography, shadows, spacing) — never arbitrary Tailwind
- Use Tailwind color utilities (`bg-primary`, `text-success`) — never hardcoded colors
- All interactive elements need `transition-all duration-normal`
- Use `cn()` for className composition

## Development

- Run `pnpm generate:types` after collection/global changes
- Run `pnpm generate:importmap` after admin components
- Use `pnpm dev:clean` for cache reset
- See [CLAUDE.md](./CLAUDE.md) for all commands
