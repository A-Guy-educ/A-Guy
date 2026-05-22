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

## Styling

See [design-system.md](./design-system.md) for complete rules. Key points:

- Use semantic design tokens (typography, shadows, spacing) — never arbitrary Tailwind or inline styles
- Use Tailwind color utilities (`bg-primary`, `text-success`) — never `[hsl(var(--xxx))]` or hardcoded colors
- All interactive elements need `transition-all duration-normal`
- Use `cn()` for className composition, never template literals

## Development

- Run `pnpm generate:types` after collection/global changes
- Run `pnpm generate:importmap` after admin components
- Use `pnpm dev:clean` for cache reset
- See [CLAUDE.md](./CLAUDE.md) for all commands

## Learned 2026-04-05 (task: 1117-260405-101944)
- Active directories: src/infra/blob, src/infra/llm/providers/shared, src/infra/pdfjs

## Learned 2026-04-05 (task: 1097-260405-135523)
- Active directories: src/server/repos/mcp/client

## Learned 2026-04-05 (task: 523-260405-133329)
- Active directories: src/server/services, tests/unit/lib/services

## Learned 2026-04-05 (task: 1121-260405-102217)
- Active directories: src/ui/web/chat/hooks, src/server/chat-assets, src/app/api/chat-assets/finalize

## Learned 2026-04-05 (task: acceptable)
- Active directories: src/infra/blob, src/ui/web/courses/PDFViewer, src/ui/web/media/PDFMedia, src/server/services

## Learned 2026-04-15 (task: 1225-260415-142959)
- Uses Payload CMS collections

## Learned 2026-04-19 (task: 2)
- Uses @/ path aliases for imports
- Active directories: src/app/api/instructor/dashboard, src/app/(frontend)/instructor/_components, tests/int, tests/e2e

## Package Manager (#1609)

`package.json` pins the package manager version via the `packageManager` field: `"packageManager": "pnpm@10.33.0"`. This makes the pnpm version explicit and reproducible across runner, local dev, and CI. `pnpm/action-setup` in CI workflows reads this field directly — do not set `version` in the action's `with:` block.

## Script Safety Guards (#1602)

Scripts that touch MongoDB or bill external services (LLM APIs) must guard against accidental runs against production:

```typescript
function assertSafeEnvironment(): void {
  if (process.env.ALLOW_LIVE === '1') return
  const uri = process.env.DATABASE_URI ?? process.env.MONGODB_URI ?? ''
  const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1') || uri.includes('mongo:')
  if (!isLocal) {
    console.error('[script] Refusing to run against non-local Mongo. Set ALLOW_LIVE=1 to override.')
    process.exit(1)
  }
}
```

Required for: any script that reads, writes, or mutates data; any script that calls billable external services.
