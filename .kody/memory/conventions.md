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

## Learned 2026-04-05 (task: 1121-260405-102217)
- Active directories: src/ui/web/chat/hooks, src/server/chat-assets, src/app/api/chat-assets/finalize

## Learned 2026-04-05 (task: acceptable)
- Active directories: src/infra/blob, src/ui/web/courses/PDFViewer, src/ui/web/media/PDFMedia, src/server/services

## Learned 2026-04-15 (task: 1225-260415-142959)
- Uses Payload CMS collections
