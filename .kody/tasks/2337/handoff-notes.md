CI was failing at the `pnpm format:check` step due to `kody.config.json` (at project root) being flagged by Prettier. The file is auto-generated/config and should not be subject to formatting checks.

**Fix**: Added `kody.config.json` to `.prettierignore` alongside `tsconfig.json` and other config files that are excluded from formatting.

**Root cause**: `.kody/**` in `.prettierignore` only excludes files *inside* the `.kody/` directory — it does not exclude `kody.config.json` at the project root. This caused CI to check the file while local environments (which may have different Prettier versions or configs) passed silently.

No other changes were made. Verify tool confirmed all quality gates pass.
