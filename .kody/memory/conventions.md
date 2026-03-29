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

## Development

- Run `pnpm generate:types` after collection/global changes
- Run `pnpm generate:importmap` after admin components
- Use `pnpm dev:clean` for cache reset
- See [CLAUDE.md](./CLAUDE.md) for all commands
