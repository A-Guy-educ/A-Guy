Fixed CI failure on PR #1377: Prettier formatting check was failing on `kody.config.json`.

Fix: Ran `pnpm format` which auto-formatted the file. After formatting, `pnpm format:check` passed with "All matched files use Prettier code style!"

The issue was subtle formatting inconsistency that Prettier normalizes on write. The file appeared correct when read but had minor style differences that Prettier's `--check` mode detected.

All quality gates verified passing via verify tool.