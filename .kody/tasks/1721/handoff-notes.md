Fixed CI format-check failure on PR #1721.

Root cause: `pnpm format:check` was failing on `kody.config.json` — Prettier detected a formatting issue in that file.

Fix: Ran `pnpm format -- "kody.config.json"` to auto-fix the formatting. The file's content was otherwise correct; it just needed Prettier to reformat it.

No code changes to the actual PR feature (HTML/CSS/SVG admin editing). All quality gates now pass.
