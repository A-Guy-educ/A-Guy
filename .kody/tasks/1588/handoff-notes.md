## Fix: Prettier format check failure in CI

**Root cause:** `CHANGELOGOG.md` line 1709 contained `([#2117\_(` — an escaped underscore inside a markdown link bracket. Prettier flags this as an unnecessary escape and fails the format check with exit code 1.

**Fix:** Replaced `([#2117\_(https://...)` with `([#2117](https://...)` on line 1709. The underscore in a markdown link URL does not need escaping; the brackets already disambiguate it.

**Verification:** `pnpm format:check` now passes with no warnings on CHANGELOGOG.md.
