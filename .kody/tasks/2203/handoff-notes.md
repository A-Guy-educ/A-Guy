Fixed the Inspector CI failure caused by a pnpm version mismatch.

Root cause: `.github/workflows/inspector.yml` pinned `pnpm/action-setup@v4` to `version: 9`, but `package.json` specifies `"packageManager": "pnpm@10.33.0"`. The action-setup action errors when both versions are present.

Fix: Changed `version: 9` → `version: 10.33.0` in inspector.yml to match package.json. No other files touched.
