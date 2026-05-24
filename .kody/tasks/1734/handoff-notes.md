## CI Fix Summary

### What happened
CI run `26364464687` on PR #1734 failed on `pnpm format:check`, flagging `kody.config.json`.

### Root cause
The failing run was triggered on commit `ecbf8b506` (merged at 14:53:23 UTC). This merge did NOT include the formatting fix for `kody.config.json` (commit `210657a96` on `origin/dev` at 13:43:16 UTC). The `dev` branch had the fix, but the `1730--ai-resumable` branch's merge pulled an earlier snapshot of `dev`.

A subsequent merge `d4d716750` (at 17:25:50 UTC) correctly incorporated `origin/dev` including the fix.

### Resolution
No code changes were needed — the fix was already in `origin/dev` and got merged via `d4d716750`. The new CI run `26367908179` on the post-merge state passed with `success`.

Local quality gates (`pnpm ci:local`) also pass.

### Files
No files were modified. The transient failure was resolved by the automatic Kody merge of `origin/dev` into `1730--ai-resumable`.