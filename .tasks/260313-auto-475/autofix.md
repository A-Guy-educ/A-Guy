# Autofix Report: 260313-auto-475

## Errors Fixed

- **TypeScript type errors**: Added `@testing-library/jest-dom` types to tsconfig.json to fix TypeScript errors about missing matchers (`toBeInTheDocument`, `toHaveValue`, `toHaveStyle`, `toHaveAttribute`, `toHaveClass`)
- **Missing package**: Installed `@testing-library/jest-dom` package (was not installed)
- **Unused ts-expect-error**: Removed unused `@ts-expect-error` directive in `axis-renderer-display-size.test.tsx` line 119
- **Vitest config**: Added `globals: true` to `vitest.config.unit.mts` to enable vitest globals (expect, describe, it, etc.)

## Changes Made

1. **tsconfig.json**: Added `types` array with `"vitest/globals"` and `"@testing-library/jest-dom"`
2. **vitest.config.unit.mts**: Added `globals: true` to test configuration
3. **tests/unit/ui/axis-renderer-display-size.test.tsx**: Removed unused `@ts-expect-error` directive

## Quality

- TypeScript: PASS
- Lint: PASS
- Format: PASS
