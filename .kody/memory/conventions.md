# Conventions

- **Imports**: Always use `@/` aliases for cross-directory imports; no relative paths across boundaries
- **Bilingual Support**: Update both `messages/en.json` (English) and `messages/he.json` (Hebrew) for any new UI strings
- **Payload CMS Workflow**: Run `pnpm generate:types` after schema changes; `pnpm generate:importmap` after admin components
- **Logging**: Use `payload.logger.*()` for structured logging; no `console.log` in production code
- **Validation**: Use Zod with `safeParse()` and check success flag; never use unsafe `parse()`
- **Immutability**: Use spread operators `{...obj, field: value}` for updates; no mutations
- **Payload Types**: After modifying Payload collections, regenerate types via `pnpm generate:types`
- **References**: [CLAUDE.md](./CLAUDE.md) for commands; [AGENTS.md](./AGENTS.md) for detailed patterns
