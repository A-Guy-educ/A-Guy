# AI Documentation Redirect

⚠️ **AI-optimized files have moved to `.ai-docs/`**

This directory now serves as a redirect map.

## New Locations

| Old Path | New Path |
|----------|----------|
| `docs/ai/schemas/` | `.ai-docs/schemas/` |
| `docs/ai/indexes/` | `.ai-docs/indexes/` |
| `docs/ai/quick-reference/` | `.ai-docs/quick-reference/` |
| `docs/ai/QUICK-START.md` | `.ai-docs/BOOTSTRAP.md` |

## Quick Reference

**Always load these first:**

1. [`.ai-docs/BOOTSTRAP.md`](../../.ai-docs/BOOTSTRAP.md) - Mandatory bootstrap ⭐
2. [`.ai-docs/quick-reference/CHEAT-SHEET.md`](../../.ai-docs/quick-reference/CHEAT-SHEET.md) - Quick patterns

## Scripts Updated

The following scripts now use `.ai-docs/`:

- `pnpm run ai:generate-patterns` - Generates pattern index
- `pnpm run ai:generate-docs` - Generates doc chunks
- `pnpm run ai:generate-all` - Both generators

## Migration Complete When

- ✅ All `pnpm run ai:*` scripts pass
- ✅ No hardcoded `docs/ai/` paths in code
- ✅ `AGENTS.md` references updated
- ✅ `package.json` scripts updated
