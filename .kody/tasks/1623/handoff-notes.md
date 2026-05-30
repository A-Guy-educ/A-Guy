CI was failing at the `pnpm format:check` step due to `kody.config.json` having
formatting issues: small arrays (`operators`, `versionFiles`) were written across
multiple lines when Prettier prefers single-line, and the file was missing a
trailing newline.

Fix: ran `npx prettier --write kody.config.json` which collapsed the two small
arrays onto single lines and added the missing trailing newline.

No code changes were made beyond formatting in this file. The PR's functional
changes (enrollments collection, migration script, etc.) are unrelated to this
CI failure.
