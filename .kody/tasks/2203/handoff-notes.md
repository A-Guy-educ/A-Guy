## Fix: CI Prettier check failing on kody.config.json

### Root Cause
kody.config.json had formatting issues detected by Prettier in the CI "Fast Gate" step.

### What Changed
Ran `pnpm format -- kody.config.json` which rewrote the file with correct Prettier formatting. No manual content changes were needed.

### Verification
- `pnpm format:check -- kody.config.json` passes (All matched files use Prettier code style)
- Full quality gates pass via `mcp__kody-verify__verify`
